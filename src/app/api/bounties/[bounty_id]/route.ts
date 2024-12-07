import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { parseBountyFromFirestoreDocument } from "@/src/_services/utils/parsers/bounty";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bounty_id: string }> }
) {
  const querry = (
    await dbSession
      .collection("bounties")
      .doc((await params).bounty_id)
      .get()
  ).data();
  if (querry) {
    return NextResponse.json(parseBountyFromFirestoreDocument(querry));
  } else {
    return NextResponse.json({}, { statusText: "Not Found", status: 404 });
  }
}
