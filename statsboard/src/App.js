import './App.css';
import { useState } from 'react';
import Plotly from 'plotly.js-dist';
import { makePlotsEIDA } from './plotsEIDA.js';
import { makePlotsNode } from './plotsNode.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenFile, setAuthTokenFile] = useState(undefined);
  const [startTime, setStartTime] = useState(undefined);
  const [endTime, setEndTime] = useState(undefined);
  const [level, setLevel] = useState("eida");
  const [showError, setShowError] = useState("");
  const [node, setNode] = useState(""); // Add this line

  function handleClick() {
    if (!showError) {
      // clear potential previous error messages
      let totalplots = document.getElementById('error-total');
      totalplots.innerHTML = "";
      let monthplots = document.getElementById('error-month');
      monthplots.innerHTML = "";
      let yearplots = document.getElementById('error-year');
      yearplots.innerHTML = "";
      let mapplots = document.getElementById('error-map');
      mapplots.innerHTML = "";
      // clear plots
      Plotly.purge('total-clients');
      Plotly.purge('total-bytes');
      Plotly.purge('total-requests');
      Plotly.purge('month-plots');
      Plotly.purge('year-plots');
      Plotly.purge('country-plots');
    }
    // clear checkboxes for map plot
    const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
    if (nodeCheckboxesContainer) {
      nodeCheckboxesContainer.innerHTML = '';
    }
    // show error and stop execution if start time not specified by user
    if (!startTime) {
      setShowError("Specify at least 'Start time' parameter!");
      return;
    }
    // otherwise clear error message
    setShowError("");
    // delay execution to allow React to update the page and create the loading-msg element, otherwise error pops up
    setTimeout(() => {
      switch(level) {
        case "eida":
          makePlotsEIDA(startTime, endTime);
          break;
        case "node":
          makePlotsNode(startTime, endTime, node);
          break;
        default:
          setShowError("Plots below Node level are not implemented yet!");
          return;
      }
    }, 200);
  }

  return (
    <div className="App">
      <h1>EIDA Statistics Dashboard</h1>
      <div className="info">
        This is a dashboard UI which allows users to explore <a href="http://www.orfeus-eu.org/data/eida/">EIDA</a> usage statistics in the form of plots.
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
      {level === "node" && (
        <div>
          <label>Node: </label>
          <input type="text" value={node} onChange={e => setNode(e.target.value)} />
        </div>
      )}
      <button onClick={handleClick}>Make Plots</button>
      {showError && (
        <div className="error-message">
          {showError}
        </div>
      )}
      {!showError && (
        <>
          <div id="loading-msg"></div>
          <div className="total-wrapper">
            <div className="error-plot" id="error-total"></div>
            <div className="total-plots">
              <div id="total-clients"></div>
              <div id="total-bytes"></div>
              <div id="total-requests"></div>
            </div>
          </div>
          <div className="month-wrapper">
            <div className="error-plot" id="error-month"></div>
            <div id="month-plots"></div>
          </div>
          <div className="year-wrapper">
            <div className="error-plot" id="error-year"></div>
            <div id="year-plots"></div>
          </div>
          <div className="map-wrapper">
            <div className="error-plot" id="error-map"></div>
            <div className="mapAndBoxes">
              <div id="country-plots"></div>
              <div id="node-checkboxes"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
