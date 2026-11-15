import { NextResponse } from "next/server";
import {
  DemoExperimentRepository,
  HttpExperimentRepository,
} from "@/modules/atlas/infra/experiments";

export async function GET(request: Request) {
  try {
    const remote = process.env.ATLAS_DATA_MODE === "remote";
    if (remote && !process.env.ATLAS_API_URL)
      return NextResponse.json(
        { error: "Backend sin configurar" },
        { status: 503 },
      );
    const repository = remote
      ? new HttpExperimentRepository(
          `${process.env.ATLAS_API_URL!.replace(/\/$/, "")}/experiments`,
        )
      : new DemoExperimentRepository();
    return NextResponse.json(
      await repository.list(
        AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "No fue posible cargar el catálogo" },
      { status: 502 },
    );
  }
}
