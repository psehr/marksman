import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { Bounty, BountyTier } from "@/src/_models/bounty";
import { parseBountyFromFirestoreDocument } from "@/src/_services/utils/parsers/bounty";
import { Filter } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const res = await request.json();
  dbSession.collection("bounties").doc(res.id).create(res);
  return NextResponse.json({ res });
}

export async function GET(request: NextRequest) {
  const querry = dbSession.collection("bounties");
  let querryFiltered;

  const searchParams = request.nextUrl.searchParams;
  const sort = searchParams.get("sort") as "recent" | "reward" | "popularity";
  const types = searchParams.get("types")?.split(",")!;
  const mods = searchParams.get("mods")?.split(",");
  const tier = searchParams.get("tier") as BountyTier;

  let querryFilteredType = querry.where("type", "in", types);
  let querryFilteredMods = querryFilteredType;

  if (mods?.length != 5) {
    if (mods?.includes("nm")) {
      querryFilteredMods = querryFilteredType.where("required_mods", "==", []);
    } else {
      querryFilteredMods = querryFilteredType.where("required_mods", "in", [
        mods,
      ]);
    }
  }
  let querryFilteredTier =
    tier == "Any"
      ? querryFilteredMods
      : querryFilteredMods.where("tier", "==", tier);

  let querrySorted = querryFilteredTier;

  switch (sort) {
    case "recent":
      querrySorted = querrySorted.orderBy("timestamp", "desc");
      break;
    case "reward":
      querrySorted = querrySorted.orderBy("reward", "desc");
      break;
  }

  const bounties_ready = (await querrySorted.get()).docs;

  let bounties: Bounty[] = [];
  for (let index = 0; index < bounties_ready.length; index++) {
    const bounty_raw = bounties_ready[index].data();
    bounties.push(parseBountyFromFirestoreDocument(bounty_raw));
  }

  return NextResponse.json(bounties);
}
