const CityMarker: React.FC<CityMarkerProps> = ({ city, onClick }) => {
  const { zoom } = useMap();
  const { buildingUpgrades } = useGameStore();

  // Размер маркера зависит от зума карты
  const size = Math.max(10, Math.min(16, zoom * 2));

  return (
    <div 
      className={`
        absolute transform -translate-x-1/2 -translate-y-1/2 
        rounded-full border-2 
        flex items-center justify-center 
        cursor-pointer hover:border-blue-400 
        transition-all duration-200
        ${city.owner === 'player' ? 'bg-blue-500 border-blue-700' : 'bg-gray-500 border-gray-700'}
      `}
      style={{ width: `${size}px`, height: `${size}px` }}
      onClick={() => onClick(city)}
    >
      <div className="text-xs font-semibold text-center text-white">
        {city.name.split(' ')[0]}

        {city.owner === 'player' && city.buildings && city.buildings.length > 0 && (
          <div className="mt-1 text-[8px]">
            {/* Показываем только те ресурсы, которые город производит */}
          </div>
        )}
      </div>
    </div>
  );
};