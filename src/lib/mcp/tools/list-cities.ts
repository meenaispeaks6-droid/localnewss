import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { indiaCities } from "../../../data/indiaCities";

export default defineTool({
  name: "list_cities",
  title: "List covered cities",
  description:
    "List Indian cities and states covered by Local News. Optionally filter by a search term matching city or state name.",
  inputSchema: {
    query: z.string().optional().describe("Optional search term for city or state name."),
    limit: z.number().int().optional().describe("Maximum cities to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query, limit }) => {
    const q = (query ?? "").trim().toLowerCase();
    const max = Math.min(Math.max(limit ?? 50, 1), 500);
    const rows = indiaCities
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.nameHi.includes(q) ||
        c.stateHi.includes(q),
      )
      .slice(0, max)
      .map((c) => ({ city: c.name, cityHi: c.nameHi, state: c.state, stateHi: c.stateHi }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, cities: rows },
    };
  },
});
