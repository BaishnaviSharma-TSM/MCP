export default function Home() {
  return (
    <>
      <div className="flex flex-col items-center justify-center ">
        <h1 className="text-6xl font-bold mb-4 text-blue-600">
          TESTING MCP with WOO commerce integration
        </h1>
        <h1 className="text-4xl">
          Welcome to the MCP Server latest with different redis
        </h1>
        <p className="text-2xl">
          This is the main page of the MCP server application.
        </p>
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="red" strokeWidth="2" />
          <path d="M8 12l2 2 4-4" stroke="blue" strokeWidth="2" fill="none" />
        </svg>
      </div>
    </>
  );
}
