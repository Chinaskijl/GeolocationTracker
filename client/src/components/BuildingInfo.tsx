// Assuming this code snippet is part of a larger React component
// and 'building' is a prop containing building data.

<div className="bg-white rounded-lg shadow-md p-4">
    <div className="text-lg font-bold">{building.name}</div>
    <div className="mt-2">
      <div className="font-semibold">{building.description}</div>

      <div className="flex mt-1 items-center">
        <div className="font-semibold mr-2">Стоимость:</div>
        <div className="flex space-x-2">
          {building.cost.gold && (
            <div className="flex items-center">
              <span className="mr-1">🪙</span>
              <span>{building.cost.gold}</span>
            </div>
          )}
          {building.cost.wood && (
            <div className="flex items-center">
              <span className="mr-1">🪵</span>
              <span>{building.cost.wood}</span>
            </div>
          )}
          {building.cost.food && (
            <div className="flex items-center">
              <span className="mr-1">🍗</span>
              <span>{building.cost.food}</span>
            </div>
          )}
          {building.cost.metal && (
            <div className="flex items-center">
              <span className="mr-1">🔩</span>
              <span>{building.cost.metal}</span>
            </div>
          )}
          {building.cost.oil && (
            <div className="flex items-center">
              <span className="mr-1">🛢️</span>
              <span>{building.cost.oil}</span>
            </div>
          )}
        </div>
      </div>

      {/* Отображение производства ресурсов */}
      {building.resourceProduction && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Производит:</div>
          <div className="flex items-center">
            <span className="mr-1">
              {building.resourceProduction.type === "gold" && "🪙"}
              {building.resourceProduction.type === "wood" && "🪵"}
              {building.resourceProduction.type === "food" && "🍗"}
              {building.resourceProduction.type === "oil" && "🛢️"}
              {building.resourceProduction.type === "metal" && "🔩"}
              {building.resourceProduction.type === "steel" && "⚙️"}
              {building.resourceProduction.type === "weapons" && "🔫"}
            </span>
            <span>+{building.resourceProduction.amount}/сек</span>
          </div>
        </div>
      )}

      {/* Отображение производства населения */}
      {building.population?.growth > 0 && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Производит:</div>
          <div className="flex items-center">
            <span className="mr-1">👥</span>
            <span>+{building.population.growth}/сек населения</span>
          </div>
        </div>
      )}

      {/* Отображение производства военной мощи */}
      {building.military?.production > 0 && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Производит:</div>
          <div className="flex items-center">
            <span className="mr-1">🪖</span>
            <span>+{building.military.production}/сек военной мощи</span>
          </div>
        </div>
      )}

      {/* Отображение потребления ресурсов */}
      {building.resourceConsumption && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Потребляет:</div>
          <div className="flex items-center">
            <span className="mr-1">
              {building.resourceConsumption.type === "gold" && "🪙"}
              {building.resourceConsumption.type === "wood" && "🪵"}
              {building.resourceConsumption.type === "food" && "🍗"}
              {building.resourceConsumption.type === "oil" && "🛢️"}
              {building.resourceConsumption.type === "metal" && "🔩"}
              {building.resourceConsumption.type === "steel" && "⚙️"}
            </span>
            <span>-{building.resourceConsumption.amount}/сек</span>
          </div>
        </div>
      )}

      {/* Отображение влияния на население */}
      {building.population && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Население:</div>
          <div className="flex space-x-2">
            {building.population.housing && (
              <div className="flex items-center">
                <span className="mr-1">🏠</span>
                <span>+{building.population.housing} макс.</span>
              </div>
            )}
            {/* Population growth is already handled above */}
          </div>
        </div>
      )}

      {/* Отображение влияния на военных */}
      {building.military && (
        <div className="flex mt-1 items-center">
          <div className="font-semibold mr-2">Военные:</div>
          <div className="flex space-x-2">
            {/* Military production is already handled above */}
            {building.military.populationUse && (
              <div className="flex items-center">
                <span className="mr-1">👥</span>
                <span>-{building.military.populationUse}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
</div>