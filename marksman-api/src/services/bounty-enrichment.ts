import { Bounty, BountyEngagement, ExtendedBounty } from "@marksman/contracts";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { findUserByOsuId } from "../db/users";
import {
  countBookmarksByBountyIds,
  isBountyBookmarkedByUser,
} from "../db/bounty-bookmarks";

async function buildExtendedBounty(
  bounty: Bounty,
  engagement: BountyEngagement,
): Promise<ExtendedBounty> {
  const beatmapId = bounty.goal.beatmapId;
  const ownerId = bounty.creatorOsuUserId;
  const winnerId = bounty.completedByOsuUserId;

  const extendedBounty: ExtendedBounty = {
    ...bounty,
    beatmap: null,
    owner: null,
    winner: null,
    engagement: engagement,
  };

  try {
    const beatmapMetadata = await getBeatmap(beatmapId);
    extendedBounty.beatmap = {
      url: beatmapMetadata.url,
      version: {
        id: beatmapMetadata.id,
        name: beatmapMetadata.version,
      },
      song: beatmapMetadata.beatmapset
        ? {
            title: beatmapMetadata.beatmapset.title,
            artist: beatmapMetadata.beatmapset.artist,
          }
        : null,
      specs: {
        sr: beatmapMetadata.difficulty_rating,
        ar: beatmapMetadata.ar,
        od: beatmapMetadata.accuracy,
        cs: beatmapMetadata.cs,
        hp: beatmapMetadata.drain,
        bpm: beatmapMetadata.bpm,
        length: {
          total: beatmapMetadata.total_length,
          drain: beatmapMetadata.hit_length,
        },
        maxCombo: beatmapMetadata.max_combo,
      },
      covers: beatmapMetadata.beatmapset
        ? {
            cover: beatmapMetadata.beatmapset.covers.cover,
            card: beatmapMetadata.beatmapset.covers.card,
          }
        : null,
      creator: beatmapMetadata.beatmapset
        ? {
            id: beatmapMetadata.beatmapset.user_id,
            username: beatmapMetadata.beatmapset.creator,
          }
        : null,
      stats: {
        status: beatmapMetadata.status,
        playcount: beatmapMetadata.playcount,
      },
    };
  } catch (error) {
    console.error(
      `Could not enrich bounty ${bounty.id} with beatmap data`,
      error,
    );
  }

  try {
    const bountyOwner = await findUserByOsuId(ownerId);
    if (bountyOwner) {
      extendedBounty.owner = bountyOwner.identity;
    } else {
      throw new Error("Bounty owner does not exist");
    }
  } catch (error) {
    console.error(
      `Could not enrich bounty ${bounty.id} with bounty owner`,
      error,
    );
  }

  if (winnerId) {
    try {
      const bountyWinner = await findUserByOsuId(winnerId);
      if (bountyWinner) {
        extendedBounty.winner = bountyWinner.identity;
      } else {
        throw new Error("Bounty winner does not exist");
      }
    } catch (error) {
      console.error(
        `Could not enrich bounty ${bounty.id} with bounty winner`,
        error,
      );
    }
  }

  return extendedBounty;
}

export async function enrichBounty(
  bounty: Bounty,
  userId?: string,
): Promise<ExtendedBounty> {
  const [row] = await countBookmarksByBountyIds([bounty.id]);

  const engagement: BountyEngagement = {
    bookmarkCount: row?.bookmarkCount ?? 0,
    isBookmarkedByCurrentUser: userId
      ? await isBountyBookmarkedByUser(bounty.id, userId)
      : null,
  };

  const enrichedBounty = await buildExtendedBounty(bounty, engagement);

  return enrichedBounty;
}

export async function enrichBounties(
  bounties: Bounty[],
): Promise<ExtendedBounty[]> {
  const bountyIds = bounties.map((bounty) => {
    return bounty.id;
  });

  const rows = await countBookmarksByBountyIds(bountyIds);

  let enrichedBounties = [];

  const countsByBountyId = new Map(
    rows.map((row) => [row.bountyId, row.bookmarkCount]),
  );

  for (let index = 0; index < bounties.length; index++) {
    const selectedBounty = bounties[index];
    const engagement: BountyEngagement = {
      bookmarkCount: countsByBountyId.get(selectedBounty.id) ?? 0,
      isBookmarkedByCurrentUser: null,
    };

    enrichedBounties.push(
      await buildExtendedBounty(selectedBounty, engagement),
    );
  }

  return enrichedBounties;
}
