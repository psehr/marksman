import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { parseUserFromFirestoreDocument } from "@/src/_services/utils/parsers/user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const querry = (
    await dbSession
      .collection("users")
      .doc((await params).user_id)
      .get()
  ).data();
  if (querry) {
    return NextResponse.json(parseUserFromFirestoreDocument(querry));
  } else {
    return NextResponse.json({}, { statusText: "Not Found", status: 404 });
  }
}
