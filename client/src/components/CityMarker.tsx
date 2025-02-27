const tooltipContent = `
    <div class="city-tooltip">
      <h3>${city.name}</h3>
      <p>Население: ${city.population} / ${city.maxPopulation}</p>
      ${city.military ? `<p>Военные: ${city.military}</p>` : ''}
    </div>
  `;