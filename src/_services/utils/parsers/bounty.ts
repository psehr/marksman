import { Bounty } from "@models/bounty";

// UNTESTED
export function parseBountyFromFirestoreDocument(
  bountyDocument: FirebaseFirestore.DocumentData
) {
  const d = bountyDocument;
  let parsedBounty: Bounty = {
    id: d.id,
    timestamp: d.timestamp,
    title: d.title,
    creator: {
      name: d.creator.name,
      id: d.creator.id,
      image: d.creator.image,
    },
    beatmapset: {
      id: d.beatmapset.id,
      url: d.beatmapset.url,
      metadata: {
        title: d.beatmapset.metadata.title,
        titleUnicode: d.beatmapset.metadata.titleUnicode,
        artist: d.beatmapset.metadata.artist,
        artistUnicode: d.beatmapset.metadata.artistUnicode,
      },
      creator: {
        name: d.beatmapset.creator.name,
        id: d.beatmapset.creator.id,
        image: d.beatmapset.creator.image,
      },
      status: d.beatmapset.status,
      cover: d.beatmapset.cover,
      slimcover: d.beatmapset.slimcover,
      card: d.beatmapset.card,
      list: d.beatmapset.list,
      versions: [],
    },
    version: {
      id: d.version.id,
      url: d.version.url,
      difficulty_name: d.version.difficulty_name,
      metadata: {
        title: d.version.metadata.title,
        titleUnicode: d.version.metadata.titleUnicode,
        artist: d.version.metadata.artist,
        artistUnicode: d.version.metadata.artistUnicode,
      },
      attributes: {
        star_rating: d.version.attributes.star_rating,
        bpm: d.version.attributes.bpm,
        overall_difficulty: d.version.attributes.overall_difficulty,
        approach_rate: d.version.attributes.approach_rate,
        drain_length: d.version.attributes.drain_length,
        max_combo: d.version.attributes.max_combo,
      },
    },
    required_mods: [],
    disallowed_mods: [],
    sliderend_leniency: d.sliderend_leniency,
    type: d.type,
    minimum_grade: d.minimum_grade,
    minimum_accuracy: d.minimum_accuracy,
    reward: d.reward,
    comments: d.comments,
    stats: {
      upvotes: d.stats.upvotes,
      downvotes: d.stats.downvotes,
      reports: d.stats.reports,
    },
    claimed: d.claimed,
    tier: d.tier || "Common",
  };

  // set versions

  for (let index = 0; index < d.beatmapset.versions.length; index++) {
    const version = d.beatmapset.versions[index];
    parsedBounty.beatmapset.versions.push(version);
  }

  // required mods

  for (let index = 0; index < d.required_mods.length; index++) {
    const required_mod = d.required_mods[index];
    parsedBounty.required_mods.push(required_mod);
  }

  // disallowed mods

  for (let index = 0; index < d.disallowed_mods.length; index++) {
    const disallowed_mod = d.disallowed_mods[index];
    parsedBounty.disallowed_mods.push(disallowed_mod);
  }

  return parsedBounty;
}
