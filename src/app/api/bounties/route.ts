import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { Bounty, BountyTier } from "@/src/_models/bounty";
import { parseBountyFromFirestoreDocument } from "@/src/_services/utils/parsers/bounty";
import { Filter } from "firebase-admin/firestore";

/**
 * POST route for creating a new bounty entry in the database.
 * @param request The bounty object is stored in the request body.
 * @returns A JSON representation of the bounty object.
 */
export async function POST(request: NextRequest) {
  const res = await request.json();
  dbSession.collection("bounties").doc(res.id).create(res);
  return NextResponse.json({ res });
}

/**
 * GET route for obtaining bounties from the database.
 * @param request A {@link NextRequest} request.
 * @returns A JSON representation of a {@link Bounty} array, parsed with the {@link parseBountyFromFirestoreDocument} method.
 *
 * @param sort The **sort order** of the response, either by date or reward, defaults to date.
 * @param types A comma separated **type filter**, restraining bounties to selected types (FC or Clear), defaults to both.
 * @param mods A comma separated **mods filter**, restraining bounties to those **having exactly** the selected mod(s) as required, defaults to all.
 * @param tier A bounty **tier filter**, restraining bounties to a single difficulty tier, defaults to all.
 *
 * @example GET "http://API_URL/bounties?sort=recent&types=FC,Clear&tier=Any&mods=nm"
 */
export async function GET(request: NextRequest) {
  try {
    const querry = dbSession.collection("bounties");

    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") as "recent" | "reward";
    const types = searchParams.get("types")?.split(",")!;
    const mods = searchParams.get("mods")?.split(",");
    const tier = searchParams.get("tier") as BountyTier;

    let querryFilteredType = types ? querry.where("type", "in", types) : querry;
    let querryFilteredMods = querryFilteredType;

    if (mods && mods?.length != 5) {
      if (mods?.includes("nm")) {
        querryFilteredMods = querryFilteredType.where(
          "required_mods",
          "==",
          []
        );
      } else {
        querryFilteredMods = querryFilteredType.where("required_mods", "in", [
          mods,
        ]);
      }
    }
    let querryFilteredTier =
      !tier || tier == "Any"
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
      default:
        querrySorted = querrySorted.orderBy("timestamp", "desc");
        break;
    }

    let bounties: Bounty[] = [];

    const bounties_ready = (await querrySorted.get()).docs;
    for (let index = 0; index < bounties_ready.length; index++) {
      const bounty_raw = bounties_ready[index].data();
      bounties.push(parseBountyFromFirestoreDocument(bounty_raw));
    }

    return NextResponse.json(bounties);
  } catch (error) {
    return NextResponse.json({}, { status: 500, statusText: "Internal Error" });
  }
}
