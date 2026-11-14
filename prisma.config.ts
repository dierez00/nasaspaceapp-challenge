import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Supabase owns migrations; this URL is only used for introspection.
    url:
      process.env.DIRECT_DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
