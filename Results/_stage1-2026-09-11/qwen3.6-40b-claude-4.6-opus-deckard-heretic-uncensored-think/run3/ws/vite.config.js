export default {
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: './public/index.html'
    }
  },
  optimizeDeps: {
    include: ['three']
  }
};
