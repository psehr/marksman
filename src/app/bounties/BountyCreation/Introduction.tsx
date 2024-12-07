import { BasicButton } from "@/src/_components/buttons";

export function Introduction({
  setStep,
  setBountyCreationModalDisplay,
}: {
  setStep: any;
  setBountyCreationModalDisplay: any;
}) {
  return (
    <div className="flex flex-col w-full h-full space-y-2 place-content-around">
      <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit">
        <p className="text-2xl p-2 px-4">Bounty creation tool</p>
      </div>
      <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit">
        <p className="text-base p-2 px-4">
          Welcome to the bounty creation tool!
        </p>
        <p className="text-sm p-2 px-4">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis
          consectetur mi vitae blandit aliquet. Suspendisse eu nibh mauris.
          Proin eget quam sodales, luctus tortor et, auctor elit. Vivamus
          aliquam quis nisi sit amet pulvinar. Quisque hendrerit justo id nisl
          faucibus maximus. Duis elementum lorem tristique nisi convallis
          feugiat. Class aptent taciti sociosqu ad litora torquent per conubia
          nostra, per inceptos himenaeos. In rutrum tortor eleifend leo
          scelerisque blandit tincidunt ut metus. Integer at nisi est. Fusce
          varius est ac ante gravida, in accumsan quam pretium. Vestibulum
          lacinia auctor erat non malesuada. In nec ante neque. Aliquam tortor
          felis, semper eu blandit quis, finibus eget justo. Ut pulvinar sit
          amet nunc ut condimentum.
        </p>
        <p className="text-sm p-2 px-4">
          Aliquam erat volutpat. Praesent feugiat leo id ligula sagittis, ut
          rutrum dui viverra. Integer elementum mi neque, sed auctor erat
          pretium nec. Mauris finibus sollicitudin felis eget tincidunt. Aliquam
          erat volutpat. Fusce tempor, nunc et egestas laoreet, erat urna semper
          diam, non vulputate est odio ac sapien. Suspendisse at est consectetur
          justo tincidunt sodales ut at tortor.
        </p>
        <p className="text-sm p-2 px-4">
          In volutpat turpis vel consectetur tristique. Suspendisse euismod
          risus a pellentesque rutrum. Integer aliquam elit augue, sed lobortis
          enim convallis ut. Donec ullamcorper libero sit amet massa varius, et
          imperdiet sapien lobortis. Maecenas id lacinia dolor. Curabitur id
          tellus dictum, tristique justo non, vestibulum felis. Morbi sit amet
          quam aliquet, pellentesque tellus consectetur, malesuada neque.
          Vivamus luctus augue massa, ac lacinia nisi consequat vitae. Nulla
          eros nisi, scelerisque et porta sed, interdum vitae ipsum. Aenean
          porttitor, nibh ac iaculis cursus, purus massa congue velit, id
          placerat quam elit ac velit. Quisque faucibus, felis vel vulputate
          ultrices, est felis condimentum tortor, a pellentesque nulla erat eu
          arcu. Donec eleifend lacinia nunc, id viverra lorem ultrices sit amet.
          Maecenas scelerisque nulla vitae urna consequat facilisis. Sed
          convallis in diam eget molestie. Vestibulum at nisi sodales risus
          tempus molestie. Curabitur non turpis nunc.
        </p>
      </div>

      <div className="flex flex-row rounded-xl bg-slate-800 w-full h-16 p-4 px-4 items-center place-content-between">
        <BasicButton
          onClick={() => {
            setBountyCreationModalDisplay(false);
          }}
          color="red"
        >
          Cancel
        </BasicButton>
        <BasicButton
          onClick={() => {
            setStep("beatmap");
          }}
          color="green"
        >
          Next step
        </BasicButton>
      </div>
    </div>
  );
}
