export default {
    providers: [
      {
        // Use SITE_URL (custom) or fall back to CONVEX_SITE_URL (built-in)
        domain: process.env.SITE_URL || process.env.CONVEX_SITE_URL,
        applicationID: "convex",
      },
    ],
  };