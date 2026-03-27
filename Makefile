.PHONY: typecheck

typecheck:
	npx --yes --package typescript tsc --project tsconfig.typecheck.json
