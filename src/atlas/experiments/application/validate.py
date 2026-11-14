"""CLI: validate data/experiments and export the JSON Schema for the front."""

import argparse
import json
import sys
from pathlib import Path

from atlas.experiments.application.load_experiments import load_experiment_files
from atlas.experiments.domain.experiment import Experiment


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", default="data/experiments", type=Path)
    parser.add_argument("--schema-out", default="data/schema/experiment.schema.json", type=Path)
    args = parser.parse_args()

    args.schema_out.parent.mkdir(parents=True, exist_ok=True)
    schema = json.dumps(Experiment.model_json_schema(), indent=2, ensure_ascii=False)
    args.schema_out.write_text(schema + "\n", encoding="utf-8")

    results = load_experiment_files(args.directory)
    failed = 0
    for result in results:
        if result.experiment:
            pending = sum(test.needs_review for test in result.experiment.tests)
            print(f"OK    {result.file}  tests={len(result.experiment.tests)}  needs_review={pending}")
        else:
            failed += 1
            print(f"FAIL  {result.file}")
            for issue in result.issues:
                print(f"      - {issue}")

    print(f"\n{len(results) - failed}/{len(results)} valid")
    sys.exit(1 if failed or not results else 0)


if __name__ == "__main__":
    main()
