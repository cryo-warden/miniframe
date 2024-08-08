const server = Bun.serve({
  port: 3000,
  fetch: async (request) => {
    const { pathname } = new URL(request.url);

    if (pathname === "/") {
      return new Response(Bun.file("./examples/assets/index.html"));
    }

    const distFile = Bun.file(`./examples/dist${pathname}`);
    const assetFile = Bun.file(`./examples/assets${pathname}`);
    const [distExists, assetExists] = await Promise.all([
      distFile.exists(),
      assetFile.exists(),
    ]);

    if (distExists) {
      return new Response(distFile);
    } else if (assetExists) {
      return new Response(assetFile);
    }

    return Response.error();
  },
});

console.log(`Listening on ${server.url}`);
