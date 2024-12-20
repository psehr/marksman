import { BasicButton } from "@/src/_components/buttons";
import { ClaimAttempt, ClaimResults, initClaim } from "@/src/_models/bounty";
import { MarksmanUser, OsuUser } from "@/src/_models/user";
import { bountyClaimAttempt } from "@/src/_services/database/bounties";
import { fetchUser } from "@services/database/users";
import { parseUserIdFromImageUrl } from "@/src/_services/utils/parsers/user";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function BountyClaim({
  bountyClaimModal,
  setBountyClaimModal,
  bounty_id,
}: {
  bountyClaimModal: { display: boolean };
  setBountyClaimModal: any;
  bounty_id: string;
}) {
  const [claimResults, setClaimResults] = useState<ClaimResults>();
  const [typedScoreUrl, setTypedScoreUrl] = useState("");
  const [userData, setUserData] = useState<MarksmanUser>();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const session = useSession();

  useEffect(() => {
    setIsAuthenticated(session.status == "authenticated");
    if (session.status == "authenticated") {
      fetchUser(parseUserIdFromImageUrl(session.data.user?.image!)).then((r) =>
        setUserData(r)
      );
    }
  }, [session.status]);

  const claimInit = async () => {
    let score_id = parseInt(
      typedScoreUrl?.split("/")[typedScoreUrl?.split("/").length - 1]
    );
    bountyClaimAttempt("manual", score_id, userData?.id!, bounty_id).then(
      (r) => {
        setClaimResults(r);
      }
    );
  };

  if (isAuthenticated) {
    return (
      <div className="fixed w-[105vw] h-full z-50 bg-black/50 flex place-content-center items-start backdrop-blur-sm space-x-8">
        <div
          className="flex flex-col w-1/2 h-fit bg-slate-700 rounded-xl place-content-center items-center mt-64 p-4 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800 w-full h-fit flex flex-col place-content-start items-center rounded-xl p-4">
            <form
              action=""
              className="w-full h-full flex place-content-center items-center"
            >
              <input
                type="text"
                placeholder="Paste your score's URL here.."
                onChange={(e) => setTypedScoreUrl(e.currentTarget.value)}
              />
            </form>
          </div>
          {claimResults ? (
            <div className="bg-slate-800 w-full h-fit flex flex-col place-content-start items-start rounded-xl p-4">
              <div className="flex flex-row space-x-2">
                <p>The score is an FC: </p>
                {claimResults.isFC ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score is a clear: </p>
                {claimResults.isClear ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score has the required mods: </p>
                {claimResults.hasRequiredMods ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score doesn't have any disallowed mod: </p>
                {claimResults.lacksDisallowedMods ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score is set on the correct beatmap: </p>
                {claimResults.isValidBeatmap ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score is from the user pretending to claim: </p>
                {claimResults.isValidUser ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
              <div className="flex flex-row space-x-2">
                <p>The score has been set after bounty creation: </p>
                {claimResults.isTimestampValid ? (
                  <p className="text-green-400">True</p>
                ) : (
                  <p className="text-red-400">False</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="bg-slate-800 w-full h-16 flex flex-row place-content-between items-center rounded-xl p-2 px-4">
            <BasicButton
              onClick={() =>
                setBountyClaimModal({ ...bountyClaimModal, display: false })
              }
              color="red"
            >
              Cancel
            </BasicButton>
            <BasicButton onClick={claimInit} color="green">
              Claim
            </BasicButton>
          </div>
        </div>
      </div>
    );
  } else {
    return <div></div>;
  }
}
