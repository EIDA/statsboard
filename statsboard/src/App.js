import './App.css';
import { useState } from 'react';
import { makePlotsEIDA } from './plotsEIDA.js';
import { makePlotsNode } from './plotsNode.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenFile, setAuthTokenFile] = useState(undefined);
  const [startTime, setStartTime] = useState(undefined);
  const [endTime, setEndTime] = useState(undefined);
  const [level, setLevel] = useState("eida");
  const [showError, setShowError] = useState("");

  function handleClick() {
    const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
    if (nodeCheckboxesContainer) {
      nodeCheckboxesContainer.innerHTML = '';
    }
    if (!startTime) {
      setShowError("Specify at least 'Start time' parameter!");
      return;
    }
    switch(level) {
      case "eida":
        makePlotsEIDA(startTime, endTime);
        break;
      case "node":
        makePlotsNode(startTime, endTime);
        break;
      default:
        setShowError("Plots below Node level are not implemented yet!");
        return;
    }
    setShowError("");
  }

  return (
    <div className="App">
      <h1>EIDA Statistics Dashboard</h1>
      <div className="info">
        This is dashboard UI which allows users to explore <a href="http://www.orfeus-eu.org/data/eida/">EIDA</a> usage statistics in the form of plots.
        For more details, visit the <a href="https://ws.resif.fr/eidaws/statistics/1/">statistics webservice.</a>
      </div>
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
      <button onClick={handleClick}>Make Plots</button>
      {showError && (
        <div className="error-message">
          {showError}
        </div>
      )}
      {!showError && (
        <>
          <div className="total-plots">
            <div id="total-clients"></div>
            <div id="total-bytes"></div>
            <div id="total-requests"></div>
          </div>
          <div id="month-plots"></div>
          <div id="year-plots"></div>
          <div className="mapAndBoxes">
            <div id="country-plots"></div>
            <div id="node-checkboxes"></div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
