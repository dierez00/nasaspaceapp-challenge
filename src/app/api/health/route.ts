import { NextResponse } from "next/server";
import { siteConfig } from "@/shared/config/site";

export function GET() {
  return NextResponse.json({ status: "ok", service: siteConfig.healthService });
}
