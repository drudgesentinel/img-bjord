<header>
  <h1>
    <a href="/">img-bjord</a>
  </h1>
</header>

<main>
  <slot />
</main>

<style>
  header {
    margin-bottom: 2rem;
  }

  h1 a {
    text-decoration: none;
    color: inherit;
  }

  h1 a:hover {
    text-decoration: underline;
  }

  main {
    max-width: 800px;
    margin: auto;
  }
</style>