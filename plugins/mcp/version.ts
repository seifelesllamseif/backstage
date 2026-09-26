// One version string for the plugin manifest, the MCP serverInfo, and the
// panel. Kept in its own module because manifest.tsx lazy-imports Panel.tsx,
// so the panel importing the manifest back would be a cycle.
//
// Bump it when the tool catalogue changes: MCP clients cache tools/list for
// the length of a session, so this is what tells a member whose assistant is
// still showing the old tools that reconnecting will fix it.
export const MCP_VERSION = '0.2.0'
