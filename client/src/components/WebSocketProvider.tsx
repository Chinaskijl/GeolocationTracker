// ... other imports ...
import { useGameStore } from './gameStore'; // Assuming this is where the store is defined

function WebSocketProvider({ children }) {
  const [gameState, setGameState] = useState(null);
  const [cities, setCities] = useState([]);
  const [resourcesIncome, setResourcesIncome] = useState({}); // Added state for resources income

  const { setCities, setGameState, setResourcesIncome } = useGameStore(); // Updated to include setResourcesIncome

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080'); // Replace with your WebSocket URL

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'CITIES_UPDATE':
          console.log('Received cities update:', data.cities);
          setCities(data.cities);
          break;
        case 'GAME_UPDATE':
          console.log('Received game state update:', data.gameState);
          setGameState(data.gameState);
          if (data.resourcesIncome) {
            console.log('Received resources income:', data.resourcesIncome);
            setResourcesIncome(data.resourcesIncome);
          }
          break;
        // ... other cases ...
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <GameContext.Provider value={{ gameState, cities, resourcesIncome }}> {/* Added resourcesIncome to context */}
      {children}
    </GameContext.Provider>
  );
}

export default WebSocketProvider;