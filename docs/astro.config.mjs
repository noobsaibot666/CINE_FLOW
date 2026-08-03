import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  // docs.alan-design.com is now a multi-product hub — CineFlow's docs live
  // under /cineflow/, with a hand-written homepage at the root linking out
  // to each product's own docs site.
  site: "https://docs.alan-design.com",
  base: "/cineflow",
  integrations: [
    starlight({
      title: "CineFlow Suite",
      sidebar: [
        {
          label: "Product",
          autogenerate: { directory: "product" }
        },
        {
          label: "Technical",
          autogenerate: { directory: "technical" }
        },
        {
          label: "User Guide",
          autogenerate: { directory: "user-guide" }
        },
        {
          label: "Legal",
          autogenerate: { directory: "legal" }
        },
        {
          label: "Development",
          autogenerate: { directory: "development" }
        }
      ]
    })
  ]
});
