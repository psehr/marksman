import Button from "../ui/Button";

export function PageSelector({
  entriesLength,
  pageSize,
  selectedPage,
  setSelectedPage,
}: {
  entriesLength: number;
  pageSize: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {selectedPage > 1 ? (
        <Button
          size="sm"
          onClick={() => {
            setSelectedPage(selectedPage - 1);
          }}
        >
          {"<"}
        </Button>
      ) : (
        "-"
      )}
      <p>Page {selectedPage}</p>
      {entriesLength < pageSize ? (
        "-"
      ) : (
        <Button
          size="sm"
          onClick={() => {
            setSelectedPage(selectedPage + 1);
          }}
        >
          {">"}
        </Button>
      )}
    </div>
  );
}
