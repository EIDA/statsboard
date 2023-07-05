import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsStation(file, startTime, endTime, node, net, sta) {

  // show message while loading
  let loadingMsg = document.getElementById("loading-msg");
  loadingMsg.innerHTML = "Loading plots. Please wait...";
  function flashLoadingMessage() {
    if (loadingMsg.innerHTML === "Loading plots. Please wait...") {
      loadingMsg.innerHTML = "Loading plots. Please wait";
    } else {
      loadingMsg.innerHTML += ".";
    }
  }
  const intervalId = setInterval(flashLoadingMessage, 500);

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&hllvalues=true&format=json`;
    fetch(url, {method: 'POST', body: file})
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        else {
          response.text().then(errorMessage => {
            if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
              let totalplots = document.getElementById('error-total');
              totalplots.innerHTML = "Service is temporarily unavailable. Please try again.";
            }
            else if (response.status >= 400 && response.status < 500) {
              let totalplots = document.getElementById('error-total');
              totalplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
            }
          });
          throw Error(response.statusText);
        }
      })
      .then((data) => {
        // sort results alphabetically by station
        data.results.sort((a, b) => {
          const stationA = a.station;
          const stationB = b.station;
          if (stationA < stationB) {
            return -1;
          }
          else if (stationA > stationB) {
            return 1;
          }
          return 0;
        });
        // calculate hll values for total clients all stations indicator plot
        let hll = new HLL(11, 5);
        data.results.forEach((result) => {
          hll.union(fromHexString(result.hll_clients).hllSet);
        });
        // group slices with less than 2% into one
        const thresholdClients = data.results.reduce((total, result) => total + result.clients, 0) * 0.02;
        const filteredResultsClients = data.results.filter(result => result.clients >= thresholdClients);
        const sumFilteredClients = filteredResultsClients.reduce((sum, result) => sum + result.clients, 0);
        const groupedSliceClients = {
          station: 'Less than 2%',
          clients: Math.round(thresholdClients / 0.02 - sumFilteredClients)
        };
        if (groupedSliceClients.clients > 0) {
          filteredResultsClients.push(groupedSliceClients);
        }
        // clients plot, per station pie at first
        const pieDataClients = {
          values: filteredResultsClients.map(result => result.clients),
          labels: filteredResultsClients.map(result => result.station),
          type: 'pie',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutClients = {
          title: 'Total number of unique users*',
          annotations: [
            {
              xshift: -20,
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '*<i>Important note: The number of unique users is correct for<br>each station. However, the whole pie does not represent<br>the real value of the total users for all selected stations, as<br>many clients may have asked data from multiple stations.<\i>',
              showarrow: false,
              font: {
                family: 'Arial',
                size: 12,
                color: 'black'
              }
            }
          ],
          updatemenus: [{
            buttons: [
              // total clients per station pie button
              {
                args: [
                  {
                    values: [filteredResultsClients.map(result => result.clients)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unique users*',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: The number of unique users is correct for<br>each station. However, the whole pie does not represent<br>the real value of the total users for all selected stations, as<br>many clients may have asked data from multiple stations.<\i>',
                        showarrow: false,
                        font: {
                          family: 'Arial',
                          size: 12,
                          color: 'black'
                        }
                      }
                    ]
                  }
                ],
                label: 'Unique Users Per Station',
                method: 'update'
              },
              // total clients for all specified stations indicator button
              {
                args: [
                  {
                    type: "indicator",
                    value: hll.cardinality(),
                    mode: "number",
                    number: { font: { size: 50 } }
                  },
                  {
                    title: 'Total number of unique users of all specified stations',
                    annotations: []
                  }
                ],
                label: 'Unique Users All Stations',
                method: 'update'
              }
            ],
            direction: 'down',
            type: 'buttons'
          }]
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

        // bytes plot
        // group slices with less than 3% into one
        const thresholdBytes = data.results.reduce((total, result) => total + result.bytes, 0) * 0.03;
        const filteredResultsBytes = data.results.filter(result => result.bytes >= thresholdBytes);
        const sumFilteredBytes = filteredResultsBytes.reduce((sum, result) => sum + result.bytes, 0);
        const groupedSliceBytes = {
          station: 'Less than 3%',
          bytes: Math.round(thresholdBytes / 0.03 - sumFilteredBytes)
        };
        if (groupedSliceBytes.bytes > 0) {
          filteredResultsBytes.push(groupedSliceBytes);
        }
        const pieDataBytes = {
          values: filteredResultsBytes.map(result => result.bytes),
          labels: filteredResultsBytes.map(result => result.station),
          type: 'pie',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutBytes = {
          title: 'Total number of bytes'
        };
        Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, {displaylogo: false});

        // requests plot
        // group slices with less than 2% into one
        const thresholdReq = data.results.reduce((total, result) => total + result.nb_reqs, 0) * 0.02;
        const filteredResultsReq = data.results.filter(result => result.nb_reqs >= thresholdReq);
        const sumFilteredReq = filteredResultsReq.reduce((sum, result) => sum + result.nb_reqs, 0);
        const groupedSliceReq = {
          station: 'Less than 2%',
          nb_reqs: Math.round(thresholdReq / 0.02 - sumFilteredReq)
        };
        if (groupedSliceReq.nb_reqs > 0) {
          filteredResultsReq.push(groupedSliceReq);
        }
        const pieDataRequests = {
          values: filteredResultsReq.map(result => result.nb_reqs),
          labels: filteredResultsReq.map(result => result.station),
          type: 'pie',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
        };
        Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&details=${details}&hllvalues=true&format=json`;
      fetch(url, {method: 'POST', body: file})
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          else {
            response.text().then(errorMessage => {
              if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                if (details === "month") {
                  let monthplots = document.getElementById('error-month');
                  monthplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                }
                else {
                  let yearplots = document.getElementById('error-year');
                  yearplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                }
              }
              else if (response.status >= 400 && response.status < 500) {
                if (details === "month") {
                  let monthplots = document.getElementById('error-month');
                  monthplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                }
                else {
                  let yearplots = document.getElementById('error-year');
                  yearplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                }
              }
            });
            throw Error(response.statusText);
          }
        })
        .then((data) => {
          const stationsSorted = Array.from(new Set(data.results.map(result => result.station))).sort((a, b) => a.localeCompare(b)).reverse();
          // calculate hll values for total clients all stations bar plot
          let hlls = {};
          data.results.forEach(result => {
            if (!hlls[result.date]) {
              hlls[result.date] = new HLL(11, 5);
            }
            hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
          });
          // needed for clients of all specified stations plot
          let clientsAllStations = [];
          stationsSorted.forEach(station => {
            clientsAllStations.push([]);
          });
          clientsAllStations[stationsSorted.length - 1] = Object.values(hlls).map(hll => hll.cardinality());
          // show clients at first
          const barData = stationsSorted.map(station => {
              const stationResults = data.results.filter(result => result.station === station);
              return {
                x: stationResults.map(result => result.date),
                y1: stationResults.map(result => result.clients),
                y2: stationResults.map(result => result.bytes),
                y3: stationResults.map(result => result.nb_reqs),
                name: station,
                type: 'bar'
              }
          });
          let barLayout = {
            height: 500,
            margin: {
              b: 100
            },
            barmode: 'stack',
            title: 'Number of unique users* per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1),
              tickmode: 'linear'
            },
            yaxis: {
              title: 'Unique users*'
            },
            showlegend: true,
            annotations: [
              {
                y: -0.32,
                xref: 'paper',
                yref: 'paper',
                text: '*<i>Important note: The number of unique users is correct for each station. However, the total number of unique users for all selected stations,<br> i.e. the height of the bars, does not represent the real value, as many clients may have asked data from multiple stations.<\i>',
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: 'black'
                }
              }
            ],
            updatemenus: [{
              buttons: [
                // clients per station button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y1),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users* per '+details,
                      yaxis: {
                        title: 'Unique users*'
                      },
                      showlegend: true,
                      annotations: [
                        {
                          y: -0.32,
                          xref: 'paper',
                          yref: 'paper',
                          text: '*<i>Important note: The number of unique users is correct for each station. However, the total number of unique users for all selected stations,<br> i.e. the height of the bars, does not represent the real value, as many clients may have asked data from multiple stations.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ]
                    }
                  ],
                  label: 'Unique Users Per station',
                  method: 'update'
                },
                // clients all specified stations button
                {
                  args: [
                    {
                      x: [Object.keys(hlls)],
                      y: clientsAllStations,
                      name: Array(stationsSorted.length).fill(""),
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users of all specified stations per '+details,
                      yaxis: {
                        title: 'Unique Users'
                      },
                      showlegend: false,
                      annotations: []
                    }
                  ],
                  label: 'Unique Users All Stations',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y2),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of bytes per '+details,
                      yaxis: {
                        title: 'Bytes'
                      },
                      showlegend: true,
                      annotations: []
                    }
                  ],
                  label: 'Bytes',
                  method: 'update'
                },
                // requests button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y3),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of requests per '+details,
                      yaxis: {
                        title: 'Requests'
                      },
                      showlegend: true,
                      annotations: []
                    }
                  ],
                  label: 'Requests',
                  method: 'update'
                },
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          if (details === "year") {
            barLayout.xaxis["dtick"] = 1;
          }
          else if (details === "month") {
            barLayout.xaxis["dtick"] = "M1";
          }
          Plotly.newPlot(details+'-plots', barData.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: 'bar', hovertemplate: '(%{x}, %{value:.3s})'})), barLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&details=country&hllvalues=true&format=json`;
      fetch(url, {method: 'POST', body: file})
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          else {
            response.text().then(errorMessage => {
              if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                let mapplots = document.getElementById('error-map');
                mapplots.innerHTML = "Service is temporarily unavailable. Please try again.";
              }
              else if (response.status >= 400 && response.status < 500) {
                let mapplots = document.getElementById('error-map');
                mapplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
              }
            });
            throw Error(response.statusText);
          }
        })
        .then((data) => {
          // aggregate the results per country
          let aggregatedResults = data.results.reduce((aggregate, result) => {
            if (!aggregate[result.country]) {
              aggregate[result.country] = {
                country: result.country,
                clients: new HLL(11, 5),
                bytes: 0,
                nb_reqs: 0
              };
            }
            aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
            aggregate[result.country].bytes += result.bytes;
            aggregate[result.country].nb_reqs += result.nb_reqs;
            return aggregate;
          }, {});
          for (const country in aggregatedResults) {
            aggregatedResults[country].clients = aggregatedResults[country].clients.cardinality();
          }
          // convert ISO-2 to ISO-3 country codes
          const iso2ToIso3 = require('country-iso-2-to-3');
          const countryCodesISO3 = Object.values(aggregatedResults).map(result => result.country).map(code => iso2ToIso3(code));

          // show clients to all nodes at first
          const mapData = [{
            locationmode: 'ISO-3',
            locations: countryCodesISO3,
            z: Object.values(aggregatedResults).map(result => result.clients),
            type: 'choroplethmapbox',
            geojson: new URL('./world-countries.json', import.meta.url).href,
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true,
            hovertemplate: '%{z:.3s}<extra>%{location}</extra>'
          }];
          let mapLayout = {
            title: 'Number of unique users per country',
            width: 1000,
            mapbox: {
              style: "open-street-map",
              center: {lon: 0, lat: 20},
              zoom: 0
            },
            updatemenus: [{
              buttons: [
                // clients button
                {
                  args: [
                    {
                      z: [Object.values(aggregatedResults).map(result => result.clients)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unique users per country',
                    }
                  ],
                  label: 'Unique Users',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      z: [Object.values(aggregatedResults).map(result => result.bytes)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of bytes per country',
                    }
                  ],
                  label: 'Bytes',
                  method: 'update'
                },
                // requests button
                {
                  args: [
                    {
                      z: [Object.values(aggregatedResults).map(result => result.nb_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of requests per country',
                    }
                  ],
                  label: 'Requests',
                  method: 'update'
                },
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          Plotly.newPlot('country-plots', mapData, mapLayout, {displaylogo: false});

          const stationsSorted = Array.from(new Set(data.results.map(result => result.station))).sort((a, b) => a.localeCompare(b));
          let stationCheckboxes = stationsSorted.map((station, index) => (
            <div key={index}>
              <input type="checkbox" id={`station-${index}`} value={station} defaultChecked onChange={handleCheckboxClick} />
              <label htmlFor={`station-${index}`}>{station}</label>
            </div>
          ));
          const stationCheckboxesContainer = document.getElementById('nns-checkboxes');
          stationCheckboxesContainer.innerHTML = '';
          ReactDOM.createRoot(stationCheckboxesContainer).render(stationCheckboxes);
          const mapAndBoxes = document.getElementById('mapAndBoxes');
          mapAndBoxes.style.backgroundColor = 'white';
          let lastClickedTime = 0;
          let lastClickedCheckbox = null;
          function handleCheckboxClick(event) {
            // first define checkboxes behavior
            const checkbox = event.target;
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastClickedTime;
            const checkboxes = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]');
            const checkedCount = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]:checked').length;
            if (checkbox === lastClickedCheckbox && timeDiff < 300) {
              if (checkedCount === 1 && checkbox.checked) {
                checkboxes.forEach((cb) => {
                  cb.checked = true;
                });
              }
              else {
                checkboxes.forEach((cb) => {
                  cb.checked = (cb === checkbox);
                });
              }
            }
            lastClickedCheckbox = checkbox;
            lastClickedTime = currentTime;
            // now update the plot with appropriate data
            const checked = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]:checked');
            const selectedStations = [];
            checked.forEach((cb) => {
              selectedStations.push(cb.value);
            })
            const filteredData = data.results.filter((result) => selectedStations.includes(result.station));
            aggregatedResults = filteredData.reduce((aggregate, result) => {
              if (!aggregate[result.country]) {
                aggregate[result.country] = {
                  country: result.country,
                  clients: new HLL(11, 5),
                  bytes: 0,
                  nb_reqs: 0
                };
              }
              aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
              aggregate[result.country].bytes += result.bytes;
              aggregate[result.country].nb_reqs += result.nb_reqs;
              return aggregate;
            }, {});
            for (const country in aggregatedResults) {
              aggregatedResults[country].clients = aggregatedResults[country].clients.cardinality();
            }
            const newCountryCodesISO3 = Object.values(aggregatedResults).map(result => result.country).map(code => iso2ToIso3(code));
            const activeButtonIndex = mapLayout.updatemenus[0].active;
            const zValues = Object.values(aggregatedResults).map(result => {
              if (activeButtonIndex === 0 || activeButtonIndex === undefined) {
                return result.clients;
              } else if (activeButtonIndex === 1) {
                return result.bytes;
              } else if (activeButtonIndex === 2) {
                return result.nb_reqs;
              }
            });
            const newMapData = [{
              locationmode: 'ISO-3',
              locations: newCountryCodesISO3,
              z: zValues,
              type: 'choroplethmapbox',
              geojson: new URL('./world-countries.json', import.meta.url).href,
              colorscale: 'Viridis',
              autocolorscale: false,
              reversescale: true,
              hovertemplate: '%{z:.3s}<extra>%{location}</extra>'
            }];
            mapLayout.updatemenus[0].buttons.forEach((button, index) => {
              if (button && index === 0) {
                button.args[0].z = [Object.values(aggregatedResults).map(result => result.clients)]
              } else if (button && index === 1) {
                button.args[0].z = [Object.values(aggregatedResults).map(result => result.bytes)]
              } else if (button && index === 2) {
                button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_reqs)]
              }
            });
            Plotly.react('country-plots', newMapData, mapLayout);
          }
        })
        .catch((error) => console.log(error))
        .finally(() => {
          // remove loading message
          clearInterval(intervalId);
          loadingMsg.innerHTML = "";
        });
    }
}
