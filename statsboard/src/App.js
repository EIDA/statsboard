import './App.css';
import { useState } from 'react';
import { makePlots } from './plots.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenFile, setAuthTokenFile] = useState(undefined);
  const [startTime, setStartTime] = useState(undefined);
  const [endTime, setEndTime] = useState(undefined);
  const [level, setLevel] = useState("eida");

  return (
    <div className="App">
      <h1>EIDA Statistics Dashboard</h1>
      <div>
        <input type="checkbox" checked={isAuthenticated} onChange={() => setIsAuthenticated(!isAuthenticated)} />
        <label>Authentication</label>
        {isAuthenticated && (
          <div>
            <label>Upload token file: </label>
            <input type="file" onChange={(event) => setAuthTokenFile(event.target.files[0])} />
            <div className="upload-note">
              To redeem an EIDA authentication token file visit <a href="https://geofon.gfz-potsdam.de/eas/">https://geofon.gfz-potsdam.de/eas</a>.
            </div>
          </div>
        )}
      </div>
      <div>
        <label>Start time: </label>
        <input type="month" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
      </div>
      <div>
        <label>End time: </label>
        <input type="month" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
      </div>
      <div>
        <label>Level: </label>
        <input type="radio" name="level" value="eida" checked={level === "eida" || (!isAuthenticated && level === "station")} onChange={e => setLevel(e.target.value)} />
        <label>EIDA </label>
        <input type="radio" name="level" value="node" checked={level === "node"} onChange={e => setLevel(e.target.value)} />
        <label>Node </label>
        <input type="radio" name="level" value="network" checked={level === "network"} onChange={e => setLevel(e.target.value)} />
        <label>Network </label>
        {isAuthenticated && (
          <>
            <input type="radio" name="level" value="station" checked={level === "station"} onChange={e => setLevel(e.target.value)} />
            <label>Station </label>
          </>
        )}
      </div>
      <div>
        <label>Plots: </label>
        <input type="checkbox" name="total" />
        <label>Total </label>
        <input type="checkbox" name="per-month" />
        <label>Per month </label>
        <input type="checkbox" name="per-year" />
        <label>Per year </label>
        <input type="checkbox" name="maps-per-country" />
        <label>Maps per country </label>
      </div>
      <button onClick={() => makePlots(startTime, endTime)}>Make Plots</button>
      <div className="plots">
        <div id="clients"></div>
        <div id="bytes"></div>
        <div id="pie-chart"></div>
      </div>
      <div id="clients-monthly"></div>
    </div>
  );
}

export default App;
