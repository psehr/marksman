export class CreatorNotFoundError extends Error {
  constructor() {
    super("Creator not found");
  }
}
export class BountyNotFoundError extends Error {
  constructor() {
    super("Bounty not found");
  }
}

export class InsufficientBpError extends Error {
  constructor() {
    super("Insufficient BP in the users balance");
  }
}

export class BountyNotOwnedError extends Error {
  constructor() {
    super("Bounty not owned by the requester");
  }
}

export class BountyNotOpenError extends Error {
  constructor() {
    super("Bounty status is not open");
  }
}

export class ScoreNotFoundError extends Error {
  constructor() {
    super("Score does not exist on remote osu! API");
  }
}

export class BeatmapMetadataUnavailableError extends Error {
  constructor() {
    super("Unable to enrich bounty with beatmap metadata");
  }
}

export class OsuApiError extends Error {
  constructor() {
    super("Could not fetch from remote osu! API");
  }
}

export class InvalidBeatmapMetadataError extends Error {
  constructor() {
    super("Beatmap metadata has malformed / missing max_combo");
  }
}

export class PayoutRecipientNotFoundError extends Error {
  constructor() {
    super("Claimant was not found");
  }
}

export class BountyOwnBookmarkError extends Error {
  constructor() {
    super("Attempting to bookmark own bounty");
  }
}

export class BeatmapNotFoundError extends Error {
  constructor() {
    super("Beatmap was not found");
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User was not found");
  }
}

export class BountyOwnHuntError extends Error {
  constructor() {
    super("Attempting to hunt own bounty");
  }
}

export class DuplicateHuntingError extends Error {
  constructor() {
    super("User is already hunting the bounty");
  }
}

export class HuntSlotsFullError extends Error {
  constructor() {
    super("User has no available hunting slot");
  }
}

export class ActiveHuntCooldownError extends Error {
  constructor() {
    super("This bounty hunting is on cooldown");
  }
}

export class HuntNotFoundError extends Error {
  constructor() {
    super("Hunt not found");
  }
}

export class HuntNotOwnedError extends Error {
  constructor() {
    super("Hunt not owned by the requester");
  }
}

export class HuntNotOngoingError extends Error {
  constructor() {
    super("Hunt not currently ongoing");
  }
}

export class HuntExpiredError extends Error {
  constructor() {
    super("Hunt has already expired");
  }
}
