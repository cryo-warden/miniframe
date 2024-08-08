await Bun.build({
  entrypoints: ["./examples/index.ts"],
  outdir: "./examples/dist",
  minify: false,
});
