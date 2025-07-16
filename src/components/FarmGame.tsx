import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Game types
interface Field {
  id: number;
  unlocked: boolean;
  planted: string | null;
  plantTime: number;
  stage: number;
}

interface Plant {
  name: string;
  price: number;
  value: number;
  growTime: number;
  icon: string;
  stages: string[];
}

interface GameState {
  money: number;
  fields: Field[];
  inventory: Record<string, number>;
  lastUpdate: number;
  maxFields: number;
}

// Plant data
const plants: Record<string, Plant> = {
  carrot: { name: 'Karotte', price: 10, value: 25, growTime: 60000, icon: '🥕', stages: ['🌱', '🌿', '🥕'] },
  potato: { name: 'Kartoffel', price: 20, value: 50, growTime: 120000, icon: '🥔', stages: ['🌱', '🌿', '🥔'] },
  tomato: { name: 'Tomate', price: 40, value: 90, growTime: 240000, icon: '🍅', stages: ['🌱', '🌿', '🍅'] },
  corn: { name: 'Mais', price: 80, value: 180, growTime: 480000, icon: '🌽', stages: ['🌱', '🌿', '🌽'] },
  onion: { name: 'Zwiebel', price: 150, value: 300, growTime: 720000, icon: '🧅', stages: ['🌱', '🌿', '🧅'] },
  pumpkin: { name: 'Kürbis', price: 300, value: 600, growTime: 960000, icon: '🎃', stages: ['🌱', '🌿', '🎃'] },
  strawberry: { name: 'Erdbeere', price: 500, value: 1000, growTime: 1200000, icon: '🍓', stages: ['🌱', '🌿', '🍓'] },
  broccoli: { name: 'Brokkoli', price: 750, value: 1500, growTime: 1500000, icon: '🥦', stages: ['🌱', '🌿', '🥦'] },
  watermelon: { name: 'Wassermelone', price: 1000, value: 2000, growTime: 1800000, icon: '🍉', stages: ['🌱', '🌿', '🍉'] },
  dragonfruit: { name: 'Drachenfrucht', price: 2000, value: 4000, growTime: 2700000, icon: '🐉', stages: ['🌱', '🌿', '🐉'] }
};

// Field prices
const fieldPrices = [0, 50, 100, 200, 500, 1000, 2000, 4000, 8000, 16000];

export default function FarmGame() {
  const { toast } = useToast();
  const [gameState, setGameState] = useState<GameState>({
    money: 10,
    fields: [{ id: 1, unlocked: true, planted: null, plantTime: 0, stage: 0 }],
    inventory: {},
    lastUpdate: Date.now(),
    maxFields: 10
  });

  const [showTutorial, setShowTutorial] = useState(true);
  const [shopModal, setShopModal] = useState(false);
  const [fieldShopModal, setFieldShopModal] = useState(false);
  const [inventoryModal, setInventoryModal] = useState(false);
  const [plantSelectionModal, setPlatSelectionModal] = useState<{show: boolean, fieldIndex: number}>({show: false, fieldIndex: -1});

  // Format time helper
  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Fertig!';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Save/Load game
  const saveGame = useCallback(() => {
    const stateToSave = { ...gameState, lastUpdate: Date.now() };
    localStorage.setItem('farmGame', JSON.stringify(stateToSave));
  }, [gameState]);

  const loadGame = useCallback(() => {
    const saved = localStorage.getItem('farmGame');
    if (saved) {
      const loadedState = JSON.parse(saved);
      updateOfflineProgress(loadedState);
      setGameState(loadedState);
    }
  }, []);

  // Update offline progress
  const updateOfflineProgress = (state: GameState) => {
    const now = Date.now();
    const timePassed = now - state.lastUpdate;
    
    state.fields.forEach(field => {
      if (field.planted && field.plantTime > 0) {
        const remainingTime = field.plantTime - timePassed;
        if (remainingTime <= 0) {
          field.stage = 3;
          field.plantTime = 0;
        } else {
          field.plantTime = remainingTime;
          const plant = plants[field.planted];
          const progress = 1 - (remainingTime / plant.growTime);
          if (progress >= 0.66) field.stage = 3;
          else if (progress >= 0.33) field.stage = 2;
          else field.stage = 1;
        }
      }
    });
  };

  // Update plant progress
  const updatePlantProgress = useCallback(() => {
    setGameState(prevState => {
      const newState = { ...prevState };
      let hasChanges = false;

      newState.fields.forEach(field => {
        if (field.planted && field.plantTime > 0) {
          field.plantTime -= 1000;
          const plant = plants[field.planted];
          const progress = 1 - (field.plantTime / plant.growTime);
          
          if (field.plantTime <= 0) {
            field.stage = 3;
            field.plantTime = 0;
            hasChanges = true;
          } else if (progress >= 0.66 && field.stage < 3) {
            field.stage = 3;
            hasChanges = true;
          } else if (progress >= 0.33 && field.stage < 2) {
            field.stage = 2;
            hasChanges = true;
          }
        }
      });

      return hasChanges ? newState : prevState;
    });
  }, []);

  // Buy field
  const buyField = (index: number) => {
    if (gameState.money >= fieldPrices[index]) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - fieldPrices[index],
        fields: [
          ...prev.fields.slice(0, index),
          { id: index + 1, unlocked: true, planted: null, plantTime: 0, stage: 0 },
          ...prev.fields.slice(index + 1)
        ]
      }));
      toast({ title: "Neues Feld gekauft!" });
    }
  };

  // Buy seed
  const buySeed = (plantKey: string) => {
    const plant = plants[plantKey];
    if (gameState.money >= plant.price) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - plant.price,
        inventory: {
          ...prev.inventory,
          [plantKey]: (prev.inventory[plantKey] || 0) + 1
        }
      }));
      toast({ title: `${plant.name} gekauft!` });
    }
  };

  // Plant seed
  const plantSeed = (plantKey: string, fieldIndex: number) => {
    if (gameState.inventory[plantKey] > 0) {
      setGameState(prev => {
        const newFields = [...prev.fields];
        const newInventory = { ...prev.inventory };
        
        newFields[fieldIndex] = {
          ...newFields[fieldIndex],
          planted: plantKey,
          plantTime: plants[plantKey].growTime,
          stage: 1
        };
        newInventory[plantKey]--;

        return {
          ...prev,
          fields: newFields,
          inventory: newInventory
        };
      });
      toast({ title: `${plants[plantKey].name} gepflanzt!` });
      setPlatSelectionModal({show: false, fieldIndex: -1});
    }
  };

  // Harvest
  const harvest = (fieldIndex: number) => {
    const field = gameState.fields[fieldIndex];
    if (field.planted && field.stage === 3) {
      const plant = plants[field.planted];
      setGameState(prev => {
        const newFields = [...prev.fields];
        newFields[fieldIndex] = {
          ...newFields[fieldIndex],
          planted: null,
          plantTime: 0,
          stage: 0
        };

        return {
          ...prev,
          money: prev.money + plant.value,
          fields: newFields
        };
      });
      toast({ title: `${plant.name} geerntet! +$${plant.value}` });
    }
  };

  // Select field for planting
  const selectField = (index: number) => {
    if (gameState.inventory && Object.keys(gameState.inventory).some(key => gameState.inventory[key] > 0)) {
      setPlatSelectionModal({show: true, fieldIndex: index});
    } else {
      toast({ title: "Kaufe zuerst Samen im Händler!" });
    }
  };

  // Effects
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePlantProgress();
      saveGame();
    }, 1000);

    return () => clearInterval(interval);
  }, [updatePlantProgress, saveGame]);

  useEffect(() => {
    const handleBeforeUnload = () => saveGame();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveGame]);

  return (
    <div className="min-h-screen bg-gradient-sky">
      {/* Header */}
      <div className="bg-card/90 p-4 flex justify-between items-center shadow-lg h-header">
        <div className="text-2xl font-bold text-farm-money">
          💰 ${gameState.money}
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          onClick={() => toast({ title: "Einstellungen kommen bald!" })}
        >
          ⚙️
        </Button>
      </div>

      {/* Tutorial */}
      {showTutorial && (
        <Card className="m-4 p-5 bg-yellow-100 border-yellow-300 text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-3">🌱 Willkommen beim Farm Clicker Game!</h2>
          <div className="text-yellow-800 space-y-2 text-sm">
            <p>1. Kaufe Samen im Händler 🛒</p>
            <p>2. Klicke auf ein Feld zum Pflanzen 🌱</p>
            <p>3. Warte bis die Pflanzen wachsen ⏰</p>
            <p>4. Ernte und verkaufe für Profit! 💰</p>
          </div>
          <Button 
            onClick={() => setShowTutorial(false)} 
            className="mt-4"
            variant="default"
          >
            Los geht's!
          </Button>
        </Card>
      )}

      {/* Game Area */}
      <div className="p-4 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: gameState.maxFields }, (_, i) => {
          const field = gameState.fields[i] || { id: i + 1, unlocked: false, planted: null, plantTime: 0, stage: 0 };
          
          return (
            <Card 
              key={i} 
              className={`p-4 text-center min-h-44 flex flex-col justify-center relative transition-all active:scale-95 ${
                !field.unlocked 
                  ? 'bg-farm-locked border-farm-locked opacity-70' 
                  : 'bg-farm-field border-farm-field-border'
              }`}
            >
              <div className="absolute top-2 left-3 bg-card/80 px-2 py-1 rounded-full text-xs font-bold">
                Feld {i + 1}
              </div>

              {!field.unlocked ? (
                <>
                  <div className="text-6xl mb-4">🔒</div>
                  {i < fieldPrices.length && (
                    <>
                      <div className="text-secondary font-bold mb-2">Preis: ${fieldPrices[i]}</div>
                      <Button 
                        onClick={() => buyField(i)}
                        disabled={gameState.money < fieldPrices[i]}
                        variant="default"
                        className="min-h-touch"
                      >
                        Kaufen
                      </Button>
                    </>
                  )}
                </>
              ) : !field.planted ? (
                <>
                  <div className="text-6xl mb-4">🌱</div>
                  <p className="mb-3">Feld bereit zum Pflanzen</p>
                  <Button 
                    onClick={() => selectField(i)}
                    variant="default"
                    className="min-h-touch"
                  >
                    Pflanzen
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">
                    {field.stage > 0 ? plants[field.planted].stages[field.stage - 1] : plants[field.planted].stages[0]}
                  </div>
                  <p className="mb-3">{plants[field.planted].name}</p>
                  
                  {field.stage === 3 && field.plantTime === 0 ? (
                    <Button 
                      onClick={() => harvest(i)}
                      variant="default"
                      className="min-h-touch"
                    >
                      Ernten
                    </Button>
                  ) : (
                    <>
                      <div className="w-full h-5 bg-muted rounded-full overflow-hidden mb-2">
                        <div 
                          className="h-full bg-gradient-progress transition-all duration-500"
                          style={{ 
                            width: `${field.plantTime > 0 ? (1 - (field.plantTime / plants[field.planted].growTime)) * 100 : 100}%` 
                          }}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">{formatTime(field.plantTime)}</div>
                    </>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 p-4 flex justify-around shadow-lg h-bottom-bar">
        <Button
          variant="secondary"
          onClick={() => setShopModal(true)}
          className="flex flex-col items-center gap-1 min-h-touch min-w-[80px]"
        >
          🛒
          <span className="text-xs">Händler</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setFieldShopModal(true)}
          className="flex flex-col items-center gap-1 min-h-touch min-w-[80px]"
        >
          🚜
          <span className="text-xs">Feld</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setInventoryModal(true)}
          className="flex flex-col items-center gap-1 min-h-touch min-w-[80px]"
        >
          📦
          <span className="text-xs">Inventar</span>
        </Button>
      </div>

      {/* Shop Modal */}
      <Dialog open={shopModal} onOpenChange={setShopModal}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🛒 Samen-Händler</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(plants).map(([key, plant]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg border-2 border-transparent hover:border-primary">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{plant.icon}</div>
                  <div>
                    <h3 className="font-semibold">{plant.name}</h3>
                    <p className="text-sm text-muted-foreground">Preis: ${plant.price}</p>
                    <p className="text-sm text-muted-foreground">Verkaufswert: ${plant.value}</p>
                    <p className="text-sm text-muted-foreground">Wachstumszeit: {formatTime(plant.growTime)}</p>
                  </div>
                </div>
                <Button
                  onClick={() => buySeed(key)}
                  disabled={gameState.money < plant.price}
                  className="min-h-touch"
                >
                  Kaufen
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Shop Modal */}
      <Dialog open={fieldShopModal} onOpenChange={setFieldShopModal}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🚜 Felder kaufen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Array.from({ length: gameState.maxFields }, (_, i) => {
              const field = gameState.fields[i];
              if (field && field.unlocked) return null;
              if (i >= fieldPrices.length) return null;

              return (
                <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg border-2 border-transparent hover:border-primary">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">🚜</div>
                    <div>
                      <h3 className="font-semibold">Feld {i + 1}</h3>
                      <p className="text-sm text-muted-foreground">Preis: ${fieldPrices[i]}</p>
                      <p className="text-sm text-muted-foreground">Erweitere deine Farm!</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => buyField(i)}
                    disabled={gameState.money < fieldPrices[i]}
                    className="min-h-touch"
                  >
                    Kaufen
                  </Button>
                </div>
              );
            }).filter(Boolean).length === 0 ? (
              <p className="text-center text-muted-foreground">Alle Felder sind bereits gekauft!</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inventory Modal */}
      <Dialog open={inventoryModal} onOpenChange={setInventoryModal}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Inventar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(gameState.inventory).filter(([_, count]) => count > 0).length === 0 ? (
              <p className="text-center text-muted-foreground">Dein Inventar ist leer. Kaufe Samen im Händler!</p>
            ) : (
              Object.entries(gameState.inventory)
                .filter(([_, count]) => count > 0)
                .map(([key, count]) => {
                  const plant = plants[key];
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="text-4xl">{plant.icon}</div>
                      <div>
                        <h3 className="font-semibold">{plant.name}</h3>
                        <p className="text-sm text-muted-foreground">Anzahl: {count}</p>
                        <p className="text-sm text-muted-foreground">Wachstumszeit: {formatTime(plant.growTime)}</p>
                        <p className="text-sm text-muted-foreground">Verkaufswert: ${plant.value}</p>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Plant Selection Modal */}
      <Dialog open={plantSelectionModal.show} onOpenChange={(open) => setPlatSelectionModal({show: open, fieldIndex: -1})}>
        <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🌱 Was möchtest du pflanzen?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(gameState.inventory)
              .filter(([_, count]) => count > 0)
              .map(([key, count]) => {
                const plant = plants[key];
                return (
                  <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg border-2 border-transparent hover:border-primary">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{plant.icon}</div>
                      <div>
                        <h3 className="font-semibold">{plant.name}</h3>
                        <p className="text-sm text-muted-foreground">Verfügbar: {count}</p>
                        <p className="text-sm text-muted-foreground">Wachstumszeit: {formatTime(plant.growTime)}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => plantSeed(key, plantSelectionModal.fieldIndex)}
                      className="min-h-touch"
                    >
                      Pflanzen
                    </Button>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}