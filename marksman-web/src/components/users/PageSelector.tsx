import Button from "../ui/Button";

export function PageSelector({
  entriesLength,
  total,
  pageSize,
  selectedPage,
  setSelectedPage,
}: {
  entriesLength: number;
  total?: number;
  pageSize: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}) {
  const hasNextPage =
    total === undefined
      ? entriesLength >= pageSize
      : selectedPage * pageSize < total;

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
      {!hasNextPage ? (
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
