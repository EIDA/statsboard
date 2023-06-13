import './App.css';
import { useState } from 'react';
import Plotly from 'plotly.js-dist';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Checkbox from '@mui/material/Checkbox';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { makePlotsEIDA } from './plotsEIDA.js';
import { makePlotsNode } from './plotsNode.js';
import { makePlotsNetwork } from './plotsNetwork.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenFile, setAuthTokenFile] = useState(undefined);
  const [startTime, setStartTime] = useState(undefined);
  const [endTime, setEndTime] = useState(undefined);
  const [level, setLevel] = useState("eida");
  const [showError, setShowError] = useState("");
  const [node, setNode] = useState("");
  const [network, setNetwork] = useState("");
  const [station, setStation] = useState("");

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
    const nodeCheckboxesContainer = document.getElementById('nns-checkboxes');
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
        case "network":
          makePlotsNetwork(startTime, endTime, node, network)
          break;
        default:
          setShowError("Plots for Station level are not implemented yet!");
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
        <FormControlLabel control={<Checkbox checked={isAuthenticated} onChange={() => {setIsAuthenticated(!isAuthenticated); setLevel("eida");}}/>} label="Authentication" />
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
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker label="Start Time" sx={{ m: 0.5 }} views={['year', 'month']} slotProps={{ textField: { size: 'small' } }} onChange={(newValue) => (newValue ? setStartTime(newValue.$y+'-'+(newValue.$M+1)) : '')} />
        </LocalizationProvider>
      </div>
      <div>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker label="End Time" sx={{ m: 0.5 }} views={['year', 'month']} slotProps={{ textField: { size: 'small' } }} onChange={(newValue) => (newValue ? setEndTime(newValue.$y+'-'+(newValue.$M+1)) : '')} />
        </LocalizationProvider>
      </div>
      <div>
        <FormControl>
          <FormLabel id="demo-row-radio-buttons-group-label">Level</FormLabel>
          <RadioGroup
            row
            aria-labelledby="demo-row-radio-buttons-group-label"
            name="row-radio-buttons-group"
          >
            <FormControlLabel value="eida" control={<Radio checked={level === "eida"} onChange={e => setLevel(e.target.value)}/>} label="EIDA" />
            <FormControlLabel value="node" control={<Radio checked={level === "node"} onChange={e => setLevel(e.target.value)}/>} label="Node" />
            <FormControlLabel value="network" control={<Radio checked={level === "network"} onChange={e => setLevel(e.target.value)}/>} label="Network" />
            {isAuthenticated && (<FormControlLabel value="station" control={<Radio checked={level === "station"} onChange={e => setLevel(e.target.value)}/>} label="Station" />)}
          </RadioGroup>
        </FormControl>
      </div>
      {level !== "eida" && (
        <div>
          <TextField label="Node" sx={{ m: 0.5 }} size="small" variant="outlined" value={node} onChange={e => setNode(e.target.value)} />
        </div>
      )}
      {(level === "network" || level === "station") && (
        <div>
          <TextField label="Network" sx={{ m: 0.5 }} size="small" variant="outlined" value={network} onChange={e => setNetwork(e.target.value)} />
        </div>
      )}
      {level === "station" && (
        <div>
          <TextField label="Station" sx={{ m: 0.5 }} size="small" variant="outlined" value={station} onChange={e => setStation(e.target.value)} />
        </div>
      )}
      <Button sx={{ m: 0.5 }} variant="contained" onClick={handleClick}>Make Plots</Button>
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
              <div id="nns-checkboxes"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
