import { NextResponse } from "next/server";
import { DemoExperimentRepository } from "@/modules/atlas/infra/experiments";
import { psiApiRepository } from "@/modules/atlas/infra/psi-api";

export async function GET(request: Request) {
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(15000),
    ]);
    if (process.env.ATLAS_DATA_MODE !== "remote")
      return NextResponse.json(await new DemoExperimentRepository().list());
    const repository = psiApiRepository();
    if (!repository)
      return NextResponse.json(
        { error: "Backend sin configurar" },
        { status: 503 },
      );
    const experiments = await repository.list(signal);
    return NextResponse.json(experiments, {
      // Backend points outside the map domain (0–16 psi, 18–50% O₂).
      headers: { "X-Atlas-Omitted": String(repository.omitted) },
    });
  } catch {
    return NextResponse.json(
      { error: "No fue posible cargar el catálogo" },
      { status: 502 },
    );
  }
}
