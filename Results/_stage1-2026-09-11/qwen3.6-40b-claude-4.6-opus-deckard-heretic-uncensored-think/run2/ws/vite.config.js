export default {
  root: '.',
  build: {
    rollupOptions: {
      input: {
        main: './public/index.html',
        game: './Space_Invaders/index.html'
      }
    }
  },
  plugins: []
};
