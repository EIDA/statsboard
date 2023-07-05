import './App.css';
import { useState, useEffect, Fragment } from 'react';
import Plotly from 'plotly.js-dist';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { makePlotsEIDA } from './plotsEIDA.js';
import { makePlotsNode } from './plotsNode.js';
import { makePlotsNetwork } from './plotsNetwork.js';
import { makePlotsStation } from './plotsStation.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTokenFile, setAuthTokenFile] = useState(undefined);
  const [startTime, setStartTime] = useState(undefined);
  const [endTime, setEndTime] = useState(undefined);
  const [level, setLevel] = useState("eida");
  const [showError, setShowError] = useState("");
  const [node, setNode] = useState([]);
  const [inputNode, setInputNode] = useState("");
  const [network, setNetwork] = useState([]);
  const [inputNetwork, setInputNetwork] = useState("");
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
      const mapAndBoxes = document.getElementById('mapAndBoxes');
      mapAndBoxes.style.backgroundColor = '#f5f5f5';
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
    // helper function for parameter passing
    function paramToPass(lst, str) {
      if (lst.length !== 0 && str) {
        return `${lst.join(',')},${str}`;
      } else if (lst.length !== 0) {
          return lst.join(',');
      } else {
        return str;
      }
    }
    // delay execution to allow React to update the page and create the loading-msg element, otherwise error pops up
    setTimeout(() => {
      switch(level) {
        case "eida":
          makePlotsEIDA(startTime, endTime);
          break;
        case "node":
          makePlotsNode(startTime, endTime, paramToPass(node, inputNode));
          break;
        case "network":
          let file = new FormData();
          file.append('file', authTokenFile);
          // if multiple networks asked
          const strNets = isAuthenticated ? paramToPass(network, inputNetwork) : (network && network.length !== 0 ? network : inputNetwork);
          if (!strNets || strNets.includes(',') || strNets === "") {
            makePlotsNetwork(isAuthenticated, file, startTime, endTime, paramToPass(node, inputNode),
              isAuthenticated ? paramToPass(network, inputNetwork) : (network && network.length !== 0 ? network : inputNetwork));
          }
          // if single network asked
          else {
            makePlotsNetwork(isAuthenticated, file, startTime, endTime, paramToPass(node, inputNode),
              isAuthenticated ? paramToPass(network, inputNetwork) : (network && network.length !== 0 ? network : inputNetwork), true);
          }
          break;
        case "station":
          let fileSta = new FormData();
          fileSta.append('file', authTokenFile);
          makePlotsStation(fileSta, startTime, endTime, paramToPass(node, inputNode), paramToPass(network, inputNetwork), station);
          break;
        default:
          setShowError("Choose level to plot statistics!")
          return;
      }
    }, 200);
  }

  // make a call to retrieve list of nodes
  async function get_nodes() {
    try {
      const response = await fetch('https://ws.resif.fr/eidaws/statistics/1/nodes');
      if (!response.ok) {
        throw new Error('Failed to fetch nodes');
      }
      const data = await response.json();
      return data.nodes.map(node => node.name).sort();
    }
    catch (error) {
      console.error(error);
      return [];
    }
  }
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const loading = open && options.length === 0;
  useEffect(() => {
    let active = true;
    if (!loading) {
      return undefined;
    }
    (async () => {
      let nodes = await get_nodes();
      if (active) {
        setOptions(nodes);
      }
    })();
    return () => {
      active = false;
    };
  }, [loading]);
  useEffect(() => {
    if (!open) {
      setOptions([]);
    }
  }, [open]);

  // make a call to retrieve list of networks
  async function get_networks() {
    try {
      const response = await fetch('https://ws.resif.fr/eidaws/statistics/1/networks');
      if (!response.ok) {
        throw new Error('Failed to fetch networks');
      }
      const data = await response.json();
      // filter networks according to the node field
      let networkNodes = new Set();
      if (Array.isArray(node)) {
        node.forEach(n => networkNodes.add(n));
      }
      if (typeof inputNode === 'string' && inputNode !== "") {
        inputNode.split(',').forEach(n => networkNodes.add(n));
      }
      if (networkNodes.size === 0) {
        setBroughtNets(true);
        return Array.from(new Set(data.networks.map(net => net.name))).sort();
      } else {
        let filteredNetworks = data.networks.filter(network => {
          return Array.from(networkNodes).includes(network.node);
        });
        setBroughtNets(true);
        return Array.from(new Set(filteredNetworks.map(net => net.name))).sort();
      }
    }
    catch (error) {
      console.error(error);
      return [];
    }
  }
  const [openNet, setOpenNet] = useState(false);
  const [optionsNet, setOptionsNet] = useState([]);
  const [broughtNets, setBroughtNets] = useState(false);
  const loadingNet = openNet && !broughtNets;
  useEffect(() => {
    let activeNet = true;
    if (!loadingNet) {
      return undefined;
    }
    (async () => {
      let networks = await get_networks();
      if (activeNet) {
        setOptionsNet(networks);
      }
    })();
    return () => {
      activeNet = false;
    };
  }, [loadingNet]);
  useEffect(() => {
    if (!openNet) {
      setOptionsNet([]);
    }
  }, [openNet]);

  return (
    <div className="App">
      <Grid id="form-container" container spacing={2}>
        <Grid id="form-left" item xs={5}>
          <h1>EIDA Statistics Dashboard</h1>
          <div className="info">
            Dashboard UI to explore <a href="http://www.orfeus-eu.org/data/eida/">EIDA</a> usage statistics in the form of plots.<br></br>
            For more details, visit the <a href="https://ws.resif.fr/eidaws/statistics/1/">statistics webservice.</a>
          </div>
          <div>
            <FormControlLabel control={<Checkbox checked={isAuthenticated} onChange={() => {setIsAuthenticated(!isAuthenticated); setAuthTokenFile(undefined);
              setLevel("eida"); setNode([]); setInputNode(""); setNetwork([]); setInputNetwork(""); setStation("");}}/>} label="Authentication" />
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
        </Grid>
        <Grid item xs={5} mt={2}>
          <div>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker label="Start Time" sx={{ my: 1 }} views={['year', 'month']} slotProps={{ textField: { size: 'small' } }} onChange={
                (newValue) => (newValue ? setStartTime(newValue.$y+'-'+(newValue.$M+1)) : setStartTime(undefined))} />
            </LocalizationProvider>
          </div>
          <div>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker label="End Time" sx={{ my: 1 }} views={['year', 'month']} slotProps={{ textField: { size: 'small' } }} onChange={
                (newValue) => (newValue ? setEndTime(newValue.$y+'-'+(newValue.$M+1)) : setEndTime(undefined))} />
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
                <FormControlLabel value="eida" control={<Radio checked={level === "eida"} onChange={e => {setLevel(e.target.value); setNode([]);
                  setInputNode(""); setNetwork([]); setInputNetwork(""); setStation("");}}/>} label="EIDA" />
                <FormControlLabel value="node" control={<Radio checked={level === "node"} onChange={e => {setLevel(e.target.value); setNetwork([]);
                  setInputNetwork(""); setStation("");}}/>} label="Node" />
                <FormControlLabel value="network" control={<Radio checked={level === "network"} onChange={e => {setLevel(e.target.value);
                  setStation("")}}/>} label="Network" />
                {isAuthenticated && (<FormControlLabel value="station" control={<Radio checked={level === "station"} onChange={e =>
                  setLevel(e.target.value)}/>} label="Station" />)}
              </RadioGroup>
            </FormControl>
          </div>
          {level !== "eida" && (
            <div>
              <Autocomplete
                className="autocomplete"
                sx={{ my: 1, minWidth: 300 }}
                size="small"
                freeSolo
                multiple
                onInputChange={e => setInputNode(e.target.value)}
                onChange={(e, nv) => {setNode(nv); setInputNode("");}}
                options={options}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                isOptionEqualToValue={(option, value) => option === value}
                loading={loading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Node"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <Fragment>
                          {loading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </Fragment>
                      ),
                    }}
                  />
                )}
              />
            </div>
          )}
          {(level === "network" || level === "station") && (
            <div>
            <Autocomplete
              className="autocomplete"
              sx={{ my: 1, minWidth: 300 }}
              size="small"
              freeSolo
              multiple={isAuthenticated}
              onInputChange={e => setInputNetwork(e.target.value)}
              onChange={(e, nv) => {setNetwork(nv); setInputNetwork("");}}
              options={optionsNet}
              open={openNet}
              onOpen={() => setOpenNet(true)}
              onClose={() => {setOpenNet(false); setBroughtNets(false);}}
              isOptionEqualToValue={(option, value) => option === value}
              loading={loadingNet}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Network"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <Fragment>
                        {loadingNet ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </Fragment>
                    ),
                  }}
                />
              )}
            />
            </div>
          )}
          {level === "station" && (
            <div>
              <TextField label="Station" sx={{ my: 1, minWidth: 300 }} size="small" variant="outlined" value={station} onChange={e => setStation(e.target.value)} />
            </div>
          )}
        </Grid>
      </Grid>
      <Button sx={{ m: 0.5 }} variant="contained" onClick={handleClick}>Make Plots</Button>
      {showError && (
        <div className="error-message">
          {showError}
        </div>
      )}
      {!showError && (
        <>
          <div id="loading-msg"></div>
          <div className="error-plot" id="error-total"></div>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={4}>
              <div className="plot" id="total-clients"></div>
            </Grid>
            <Grid item xs={12} lg={4}>
              <div className="plot" id="total-bytes"></div>
            </Grid>
            <Grid item xs={12} lg={4}>
              <div className="plot" id="total-requests"></div>
            </Grid>
          </Grid>
          <div className="error-plot" id="error-month"></div>
          <div className="plot" id="month-plots"></div>
          <div className="error-plot" id="error-year"></div>
          <div className="plot" id="year-plots"></div>
          <div className="error-plot" id="error-map"></div>
          <div id="mapAndBoxes">
            <div id="country-plots"></div>
            <div id="nns-checkboxes"></div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
