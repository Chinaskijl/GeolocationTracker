<div key={key} className="flex items-center justify-between">
              <span>{getResourceIcon(key)} {key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <span>
                {Math.floor(value)}
                {gameStore.resourcesIncome && gameStore.resourcesIncome[key] > 0 && (
                  <span className="text-green-500 text-xs ml-1">+{gameStore.resourcesIncome[key].toFixed(1)}/с</span>
                )}
                {gameStore.resourcesIncome && gameStore.resourcesIncome[key] < 0 && (
                  <span className="text-red-500 text-xs ml-1">{gameStore.resourcesIncome[key].toFixed(1)}/с</span>
                )}
              </span>
            </div>