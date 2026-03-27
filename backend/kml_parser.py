from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re
from typing import Optional, TypedDict
import xml.etree.ElementTree as ET

KML_NS = "http://www.opengis.net/kml/2.2"
NS = {"kml": KML_NS}

MCC_MNC_RE = re.compile(r"MCC:\s*(?P<mcc>\d+)\s+MNC:\s*(?P<mnc>\d+)", re.IGNORECASE)
LAC_CID_RNC_PSC_RE = re.compile(
    r"LAC:\s*(?P<lac>\d+)\s+CID:\s*(?P<cid>[^\s]+)\s+RNC:\s*(?P<rnc>\d+)\s+PSC:\s*(?P<psc>\d+)",
    re.IGNORECASE,
)
DISTANCE_RE = re.compile(r"~\s*(\d+(?:\.\d+)?)\s*\(m\)", re.IGNORECASE)
DESCRIPTION_FIELD_RE = re.compile(r"^\s*([A-Z_]+)\s*:\s*(.+?)\s*$")
NUMERIC_NAME_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")
RADIO_TECH_RE = re.compile(r"\b(GSM|LTE|WCDMA)\b", re.IGNORECASE)


@dataclass(slots=True)
class OperatorGroup:
    mcc: int
    mnc: int


@dataclass(slots=True)
class StyleDef:
    style_id: str
    icon_color: Optional[str] = None
    icon_scale: Optional[float] = None
    icon_href: Optional[str] = None
    line_color: Optional[str] = None
    line_width: Optional[float] = None


@dataclass(slots=True)
class CellSite:
    name: str
    radio: str
    lat: float
    lon: float
    operator: Optional[OperatorGroup] = None
    lac: Optional[int] = None
    cid: Optional[str] = None
    rnc: Optional[int] = None
    psc: Optional[int] = None
    style_url: Optional[str] = None
    distance_m: Optional[float] = None
    accuracy: Optional[float] = None
    change_type: Optional[str] = None
    timestamp: Optional[str] = None
    description: Optional[str] = None


@dataclass(slots=True)
class SignalSample:
    dbm: float
    lat: float
    lon: float
    operator: Optional[OperatorGroup] = None
    lac: Optional[int] = None
    cid: Optional[str] = None
    rnc: Optional[int] = None
    psc: Optional[int] = None
    style_url: Optional[str] = None
    accuracy: Optional[float] = None
    change_type: Optional[str] = None
    timestamp: Optional[str] = None
    description: Optional[str] = None


@dataclass(slots=True)
class GpsTrack:
    name: str
    coordinates: list[tuple[float, float, Optional[float]]] = field(default_factory=list)
    style_url: Optional[str] = None


@dataclass(slots=True)
class KmlParseResult:
    operator_groups: list[OperatorGroup] = field(default_factory=list)
    cell_sites: list[CellSite] = field(default_factory=list)
    signal_samples: list[SignalSample] = field(default_factory=list)
    gps_tracks: list[GpsTrack] = field(default_factory=list)
    styles: list[StyleDef] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class IngestionOperatorGroup(TypedDict):
    mcc: int
    mnc: int


class IngestionCellSite(TypedDict, total=False):
    name: str
    radio: str
    lat: float
    lon: float
    operator: IngestionOperatorGroup
    lac: int
    cid: str
    rnc: int
    psc: int
    station_id: str
    style_url: str
    distance_m: float
    accuracy: float
    change_type: str
    timestamp: str
    description: str


class IngestionSignalSample(TypedDict, total=False):
    dbm: float
    lat: float
    lon: float
    operator: IngestionOperatorGroup
    lac: int
    cid: str
    rnc: int
    psc: int
    station_id: str
    style_url: str
    accuracy: float
    change_type: str
    timestamp: str
    description: str


class KmlIngestionPayload(TypedDict):
    schema_version: str
    cell_sites: list[IngestionCellSite]
    signal_samples: list[IngestionSignalSample]
    warnings: list[str]


class IngestionContractError(ValueError):
    pass


def normalize_station_id(mcc: int, mnc: int, lac: int, cid: str, psc: int) -> str:
    cid_normalized = str(cid).strip()
    if not cid_normalized:
        raise IngestionContractError("stationId normalization failed: CID is empty")
    return f"{int(mcc)}-{int(mnc)}-{int(lac)}-{cid_normalized}-{int(psc)}"


def to_ingestion_payload(parsed: KmlParseResult) -> KmlIngestionPayload:
    cell_sites: list[IngestionCellSite] = []
    signal_samples: list[IngestionSignalSample] = []

    for idx, site in enumerate(parsed.cell_sites):
        if site.operator is None or site.lac is None or site.cid is None or site.psc is None:
            raise IngestionContractError(
                f"cell_sites[{idx}] is missing station ID parts (operator/lac/cid/psc)"
            )

        station_id = normalize_station_id(
            mcc=site.operator.mcc,
            mnc=site.operator.mnc,
            lac=site.lac,
            cid=site.cid,
            psc=site.psc,
        )

        cell_sites.append(
            {
                "name": site.name,
                "radio": site.radio,
                "lat": site.lat,
                "lon": site.lon,
                "operator": {"mcc": site.operator.mcc, "mnc": site.operator.mnc},
                "lac": site.lac,
                "cid": site.cid,
                "rnc": site.rnc,
                "psc": site.psc,
                "station_id": station_id,
                "style_url": site.style_url,
                "distance_m": site.distance_m,
                "accuracy": site.accuracy,
                "change_type": site.change_type,
                "timestamp": site.timestamp,
                "description": site.description,
            }
        )

    for idx, sample in enumerate(parsed.signal_samples):
        if sample.operator is None or sample.lac is None or sample.cid is None or sample.psc is None:
            raise IngestionContractError(
                f"signal_samples[{idx}] is missing station ID parts (operator/lac/cid/psc)"
            )

        station_id = normalize_station_id(
            mcc=sample.operator.mcc,
            mnc=sample.operator.mnc,
            lac=sample.lac,
            cid=sample.cid,
            psc=sample.psc,
        )

        signal_samples.append(
            {
                "dbm": sample.dbm,
                "lat": sample.lat,
                "lon": sample.lon,
                "operator": {"mcc": sample.operator.mcc, "mnc": sample.operator.mnc},
                "lac": sample.lac,
                "cid": sample.cid,
                "rnc": sample.rnc,
                "psc": sample.psc,
                "station_id": station_id,
                "style_url": sample.style_url,
                "accuracy": sample.accuracy,
                "change_type": sample.change_type,
                "timestamp": sample.timestamp,
                "description": sample.description,
            }
        )

    return {
        "schema_version": "1.0.0",
        "cell_sites": cell_sites,
        "signal_samples": signal_samples,
        "warnings": list(parsed.warnings),
    }


def parse_kml_file(path: str | Path) -> KmlParseResult:
    tree = ET.parse(path)
    return parse_kml_root(tree.getroot())


def parse_kml_root(root: ET.Element) -> KmlParseResult:
    result = KmlParseResult()

    result.styles.extend(_parse_styles(root))

    document = root.find("kml:Document", NS)
    if document is None:
        result.warnings.append("KML Document node not found")
        return result

    seen_operator_groups: set[tuple[int, int]] = set()

    for folder in document.findall("kml:Folder", NS):
        _parse_folder_tree(folder, result, seen_operator_groups, operator=None, cell_meta=None)

    for placemark in document.findall("kml:Placemark", NS):
        _parse_placemark(placemark, result, operator=None, cell_meta=None)

    return result


def _parse_styles(root: ET.Element) -> list[StyleDef]:
    styles: list[StyleDef] = []
    for style in root.findall(".//kml:Style", NS):
        style_id = style.attrib.get("id")
        if not style_id:
            continue

        icon_color = _find_text(style, "kml:IconStyle/kml:color")
        icon_scale = _to_float(_find_text(style, "kml:IconStyle/kml:scale"))
        icon_href = _find_text(style, "kml:IconStyle/kml:Icon/kml:href")
        line_color = _find_text(style, "kml:LineStyle/kml:color")
        line_width = _to_float(_find_text(style, "kml:LineStyle/kml:width"))

        styles.append(
            StyleDef(
                style_id=style_id,
                icon_color=icon_color,
                icon_scale=icon_scale,
                icon_href=icon_href,
                line_color=line_color,
                line_width=line_width,
            )
        )
    return styles


def _parse_folder_tree(
    folder: ET.Element,
    result: KmlParseResult,
    seen_operator_groups: set[tuple[int, int]],
    operator: Optional[OperatorGroup],
    cell_meta: Optional[dict[str, object]],
) -> None:
    folder_name = (_find_text(folder, "kml:name") or "").strip()

    parsed_operator = _parse_operator_folder(folder_name) or operator
    if parsed_operator:
        key = (parsed_operator.mcc, parsed_operator.mnc)
        if key not in seen_operator_groups:
            seen_operator_groups.add(key)
            result.operator_groups.append(parsed_operator)

    parsed_cell_meta = _parse_cell_folder(folder_name) or cell_meta

    placemarks = folder.findall("kml:Placemark", NS)
    subfolders = folder.findall("kml:Folder", NS)
    if not placemarks and not subfolders:
        if folder_name:
            result.warnings.append(f"Empty folder skipped: {folder_name}")
        else:
            result.warnings.append("Empty unnamed folder skipped")

    for placemark in placemarks:
        _parse_placemark(placemark, result, parsed_operator, parsed_cell_meta)

    for subfolder in subfolders:
        _parse_folder_tree(subfolder, result, seen_operator_groups, parsed_operator, parsed_cell_meta)


def _parse_placemark(
    placemark: ET.Element,
    result: KmlParseResult,
    operator: Optional[OperatorGroup],
    cell_meta: Optional[dict[str, object]],
) -> None:
    name = (_find_text(placemark, "kml:name") or "").strip()
    description = (_find_text(placemark, "kml:description") or "").strip()
    style_url = (_find_text(placemark, "kml:styleUrl") or "").strip() or None
    description_meta = _parse_description_meta(description)

    line = placemark.find("kml:LineString", NS)
    if line is not None:
        coordinates = _parse_coordinates_text(_find_text(line, "kml:coordinates"), result, name)
        if coordinates:
            result.gps_tracks.append(GpsTrack(name=name or "unnamed_track", coordinates=coordinates, style_url=style_url))
        return

    point = placemark.find("kml:Point", NS)
    if point is None:
        return

    coordinates = _parse_coordinates_text(_find_text(point, "kml:coordinates"), result, name)
    if not coordinates:
        return
    lon, lat, _alt = coordinates[0]

    merged_meta = _merge_cell_meta(cell_meta, _parse_cell_from_description(description))
    lac = _as_int(merged_meta.get("lac") if merged_meta else None)
    cid = str(merged_meta.get("cid")) if merged_meta and merged_meta.get("cid") is not None else None
    rnc = _as_int(merged_meta.get("rnc") if merged_meta else None)
    psc = _as_int(merged_meta.get("psc") if merged_meta else None)

    if NUMERIC_NAME_RE.fullmatch(name):
        result.signal_samples.append(
            SignalSample(
                dbm=float(name),
                lat=lat,
                lon=lon,
                operator=operator,
                lac=lac,
                cid=cid,
                rnc=rnc,
                psc=psc,
                style_url=style_url,
                accuracy=_to_float(description_meta.get("ACCURACY")),
                change_type=description_meta.get("CHANGE_TYPE"),
                timestamp=description_meta.get("TIMESTAMP"),
                description=description or None,
            )
        )
        return

    radio_match = RADIO_TECH_RE.search(name)
    if radio_match:
        result.cell_sites.append(
            CellSite(
                name=name,
                radio=radio_match.group(1).upper(),
                lat=lat,
                lon=lon,
                operator=operator,
                lac=lac,
                cid=cid,
                rnc=rnc,
                psc=psc,
                style_url=style_url,
                distance_m=_to_float(description_meta.get("distance_m")),
                accuracy=_to_float(description_meta.get("ACCURACY")),
                change_type=description_meta.get("CHANGE_TYPE"),
                timestamp=description_meta.get("TIMESTAMP"),
                description=description or None,
            )
        )


def _parse_coordinates_text(
    coordinates_text: Optional[str],
    result: KmlParseResult,
    placemark_name: str,
) -> list[tuple[float, float, Optional[float]]]:
    if not coordinates_text or not coordinates_text.strip():
        result.warnings.append(f"Placemark '{placemark_name or 'unnamed'}' has empty <coordinates>")
        return []

    parsed: list[tuple[float, float, Optional[float]]] = []
    for chunk in coordinates_text.strip().split():
        parts = chunk.split(",")
        if len(parts) < 2:
            continue
        lon = _to_float(parts[0])
        lat = _to_float(parts[1])
        alt = _to_float(parts[2]) if len(parts) > 2 else None
        if lon is None or lat is None:
            continue
        parsed.append((lon, lat, alt))
    return parsed


def _parse_operator_folder(folder_name: str) -> Optional[OperatorGroup]:
    match = MCC_MNC_RE.search(folder_name)
    if not match:
        return None
    return OperatorGroup(mcc=int(match.group("mcc")), mnc=int(match.group("mnc")))


def _parse_cell_folder(folder_name: str) -> Optional[dict[str, object]]:
    match = LAC_CID_RNC_PSC_RE.search(folder_name)
    if not match:
        return None
    return {
        "lac": int(match.group("lac")),
        "cid": match.group("cid"),
        "rnc": int(match.group("rnc")),
        "psc": int(match.group("psc")),
    }


def _parse_cell_from_description(description: str) -> Optional[dict[str, object]]:
    return _parse_cell_folder(description.replace("\n", " "))


def _parse_description_meta(description: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    if not description:
        return meta

    distance_match = DISTANCE_RE.search(description)
    if distance_match:
        meta["distance_m"] = distance_match.group(1)

    for line in description.splitlines():
        field_match = DESCRIPTION_FIELD_RE.match(line)
        if field_match:
            meta[field_match.group(1)] = field_match.group(2)
    return meta


def _merge_cell_meta(
    base_meta: Optional[dict[str, object]],
    override_meta: Optional[dict[str, object]],
) -> dict[str, object]:
    merged: dict[str, object] = {}
    if base_meta:
        merged.update(base_meta)
    if override_meta:
        merged.update({k: v for k, v in override_meta.items() if v is not None})
    return merged


def _find_text(node: ET.Element, path: str) -> Optional[str]:
    found = node.find(path, NS)
    if found is None:
        return None
    return found.text


def _to_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return None


def _as_int(value: object) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None
