import "server-only";
import { NextResponse } from "next/server";
import { getStats } from "@/lib/text-query/error-tracker";

export async function GET() {
  return NextResponse.json(getStats());
}
