import React, { useState, useEffect } from "react";
import styles from "./Standings.module.css";

// Componente "Carregando..."
const LoadingSpinner = () => (
  <div className={styles.loading}>Carregando dados da F1...</div>
);

// Componente para o Pódio
function LastRace({ data }) {
  if (!data || !data.Races || data.Races.length === 0) return null;
  const lastRace = data.Races[0];
  const results = lastRace.Results;

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>
        Última Corrida: {lastRace.raceName}
      </h3>
      <ol className={styles.podiumList}>
        {results.slice(0, 3).map((driver) => (
          <li key={driver.position}>
            <span className={styles.position}>{driver.position}</span>
            <span className={styles.driverName}>
              {driver.Driver.givenName}{" "}
              <strong>{driver.Driver.familyName}</strong>
            </span>
            <span className={styles.constructorName}>
              {driver.Constructor.name}
            </span>
            <span className={styles.points}>+{driver.points} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Componente para a Pontuação
function DriverStandings({ data }) {
  if (!data || !data.StandingsLists || data.StandingsLists.length === 0)
    return null;
  const drivers = data.StandingsLists[0].DriverStandings;

  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Pontuação (Pilotos)</h3>
      <ol className={styles.standingsList}>
        {drivers.slice(0, 5).map(
          (
            driver // Mostra o Top 5
          ) => (
            <li key={driver.position}>
              <span className={styles.position}>{driver.position}</span>
              <span className={styles.driverName}>
                {driver.Driver.givenName}{" "}
                <strong>{driver.Driver.familyName}</strong>
              </span>
              <span className={styles.constructorName}>
                {driver.Constructor.name}
              </span>
              <span className={styles.points}>{driver.points} pts</span>
            </li>
          )
        )}
      </ol>
    </div>
  );
}

// Componente Principal
function Standings() {
  const [lastRaceData, setLastRaceData] = useState(null);
  const [standingsData, setStandingsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // AS URLs DA FONTE (sem proxy)
    const lastRaceUrl = "https://ergast.com/api/f1/2025/last/results.json";
    const standingsUrl = "https://ergast.com/api/f1/2025/driverStandings.json";

    async function fetchData() {
      try {
        setIsLoading(true);

        // Faz as duas buscas DIRETAMENTE, SEM PROXY
        const [raceResponse, standingsResponse] = await Promise.all([
          fetch(lastRaceUrl),
          fetch(standingsUrl),
        ]);

        if (!raceResponse.ok || !standingsResponse.ok) {
          throw new Error("Falha ao buscar dados da Ergast API");
        }

        // Agora podemos ler como .json() direto, é mais limpo
        const raceData = await raceResponse.json();
        const standingsData = await standingsResponse.json();

        // NÃO precisamos mais do JSON.parse(text.replace...)

        setLastRaceData(raceData.MRData.RaceTable);
        setStandingsData(standingsData.MRData.StandingsTable);
      } catch (err) {
        console.error("Erro ao buscar dados de pódio/pontuação:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []); // Roda só uma vez

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className={styles.loadingError}>
        Não foi possível carregar os dados de pontuação. A API pode estar
        offline.
      </div>
    );
  }

  return (
    <div className={styles.standingsContainer}>
      <DriverStandings data={standingsData} />
      <LastRace data={lastRaceData} />
    </div>
  );
}

export default Standings;
