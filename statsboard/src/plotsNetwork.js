import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsNetwork(isAuthenticated, file, startTime, endTime, node, net, single=false) {
// if single=true toggle mode for one (shared) network, i.e. show statistics per node that shares this network

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
    let url;
    if (isAuthenticated) {
      url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&hllvalues=true&format=json`;
    } else {
      url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&hllvalues=true&format=json`;
    }
    fetch(url, {method: isAuthenticated ? 'POST' : 'GET', body: isAuthenticated ? file : null})
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
        // sort results alphabetically by network
        data.results.sort((a, b) => {
          const networkA = a.network;
          const networkB = b.network;
          if (networkA < networkB) {
            return -1;
          } else if (networkA > networkB) {
            return 1;
          }
          return 0;
        });
        // calculate hll values for shared networks and for total clients all networks indicator plot
        let foundNets = {};
        let hll = new HLL(11, 5);
        data.results.forEach((result) => {
          let network;
          if (single) {
            network = result.node;
          } else {
            network = result.network || "N/A";
          }
          const clients = result.hll_clients;
          if (foundNets[network]) {
            foundNets[network].union(fromHexString(result.hll_clients).hllSet);
          } else {
            foundNets[network] = fromHexString(clients).hllSet;
          }
          hll.union(fromHexString(result.hll_clients).hllSet);
        });
        // group slices with less than 3% into one
        const thresholdClients = Object.values(foundNets).reduce((total, value) => total + value.cardinality(), 0) * 0.03;
        let groupedDataClients = {values: [], labels: []};
        Object.entries(foundNets).forEach(([network, value]) => {
          if (value.cardinality() >= thresholdClients) {
            groupedDataClients.values.push(value);
            if (single) {
              groupedDataClients.labels.push(`${net} (${network})`);
            } else {
              groupedDataClients.labels.push(network);
            }
          } else {
            if (!groupedDataClients.labels.includes('Less than 3%')) {
              groupedDataClients.values.push(value);
              groupedDataClients.labels.push('Less than 3%');
            } else {
              const index = groupedDataClients.labels.indexOf('Less than 3%');
              groupedDataClients.values[index].union(value);
            }
          }
        });
        // clients plot, per network pie at first
        let pieDataClients = {
          values: groupedDataClients.values.map(value => value.cardinality()),
          labels: groupedDataClients.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutClients = {
          title: 'Total number of users* per network',
          annotations: [
            {
              xshift: -20,
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '*<i>Important note: The number of unique users is correct for<br>each network. However, the whole pie does not represent<br>the real value of the total users for all selected networks, as<br>many clients may have asked data from multiple networks.<\i>',
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
              // total clients per network pie button
              {
                args: [
                  {
                    values: [groupedDataClients.values.map(value => value.cardinality())],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of users* per network',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: The number of unique users is correct for<br>each network. However, the whole pie does not represent<br>the real value of the total users for all selected networks, as<br>many clients may have asked data from multiple networks.<\i>',
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
                label: 'Users Per Network',
                method: 'update'
              },
              // total clients for all specified networks indicator button
              {
                args: [
                  {
                    type: "indicator",
                    value: hll.cardinality(),
                    mode: "number",
                    number: { font: { size: 50 } }
                  },
                  {
                    title: 'Total number of unique users of all networks',
                    annotations: []
                  }
                ],
                label: 'Users All Networks',
                method: 'update'
              }
            ],
            direction: 'down',
            type: 'buttons'
          }]
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

        // bytes plot
        // take care of shared networks
        const sharedBytes = data.results.reduce((accumulator, result) => {
          let network;
          if (single) {
            network = result.node;
          } else {
            network = result.network || "N/A";
          }
          const index = accumulator.networks.indexOf(network);
          if (index !== -1) {
            accumulator.bytes[index] += result.bytes;
          } else {
            accumulator.bytes.push(result.bytes);
            if (single) {
              accumulator.networks.push(`${net} (${network})`);
            } else {
              accumulator.networks.push(network);
            }
          }
          return accumulator;
        }, { bytes: [], networks: [] });
        // group slices with less than 3% into one
        const thresholdBytes = data.results.reduce((total, result) => total + result.bytes, 0) * 0.03;
        const groupedDataBytes = sharedBytes.networks.reduce((accumulator, network, index) => {
          if (sharedBytes.bytes[index] >= thresholdBytes) {
            accumulator.values.push(sharedBytes.bytes[index]);
            accumulator.labels.push(network);
          } else {
            if (!accumulator.labels.includes('Less than 3%')) {
              accumulator.values.push(sharedBytes.bytes[index]);
              accumulator.labels.push('Less than 3%');
            } else {
              const lessThan3Index = accumulator.labels.indexOf('Less than 3%');
              accumulator.values[lessThan3Index] += sharedBytes.bytes[index];
            }
          }
          return accumulator;
        }, { values: [], labels: [] });
        const pieDataBytes = {
          values: groupedDataBytes.values,
          labels: groupedDataBytes.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutBytes = {
          title: 'Total number of bytes'
        };
        Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, {displaylogo: false});

        // requests plot
        // take care of shared networks
        const sharedReq = data.results.reduce((accumulator, result) => {
          let network;
          if (single) {
            network = result.node;
          } else {
            network = result.network || "N/A";
          }
          const index = accumulator.networks.indexOf(network);
          if (index !== -1) {
            accumulator.nb_reqs[index] += result.nb_reqs;
            accumulator.nb_successful_reqs[index] += result.nb_successful_reqs;
          } else {
            accumulator.nb_reqs.push(result.nb_reqs);
            accumulator.nb_successful_reqs.push(result.nb_successful_reqs);
            if (single) {
              accumulator.networks.push(`${net} (${network})`);
            } else {
              accumulator.networks.push(network);
            }
          }
          return accumulator;
        }, { nb_reqs: [], nb_successful_reqs: [], networks: [] });
        // group slices with less than 3% into one for total requests
        const thresholdTot = data.results.reduce((total, result) => total + result.nb_reqs, 0) * 0.03;
        const groupedDataTot = sharedReq.networks.reduce((accumulator, network, index) => {
          if (sharedReq.nb_reqs[index] >= thresholdTot) {
            accumulator.values.push(sharedReq.nb_reqs[index]);
            accumulator.labels.push(network);
          } else {
            if (!accumulator.labels.includes('Less than 3%')) {
              accumulator.values.push(sharedReq.nb_reqs[index]);
              accumulator.labels.push('Less than 3%');
            } else {
              const lessThan3Index = accumulator.labels.indexOf('Less than 3%');
              accumulator.values[lessThan3Index] += sharedReq.nb_reqs[index];
            }
          }
          return accumulator;
        }, { values: [], labels: [] });
        // group slices with less than 3% into one for successful requests
        const thresholdSucc = data.results.reduce((total, result) => total + result.nb_successful_reqs, 0) * 0.03;
        const groupedDataSucc = sharedReq.networks.reduce((accumulator, network, index) => {
          if (sharedReq.nb_successful_reqs[index] >= thresholdSucc) {
            accumulator.values.push(sharedReq.nb_successful_reqs[index]);
            accumulator.labels.push(network);
          } else {
            if (!accumulator.labels.includes('Less than 3%')) {
              accumulator.values.push(sharedReq.nb_successful_reqs[index]);
              accumulator.labels.push('Less than 3%');
            } else {
              const lessThan3Index = accumulator.labels.indexOf('Less than 3%');
              accumulator.values[lessThan3Index] += sharedReq.nb_successful_reqs[index];
            }
          }
          return accumulator;
        }, { values: [], labels: [] });
        // group slices with less than 3% into one for unsuccessful requests
        const thresholdUnsucc = data.results.reduce((total, result) => total + result.nb_reqs - result.nb_successful_reqs, 0) * 0.03;
        const groupedDataUnsucc = sharedReq.networks.reduce((accumulator, network, index) => {
          if (sharedReq.nb_reqs[index] - sharedReq.nb_successful_reqs[index] >= thresholdUnsucc) {
            accumulator.values.push(sharedReq.nb_reqs[index] - sharedReq.nb_successful_reqs[index]);
            accumulator.labels.push(network);
          } else {
            if (!accumulator.labels.includes('Less than 3%')) {
              accumulator.values.push(sharedReq.nb_reqs[index] - sharedReq.nb_successful_reqs[index]);
              accumulator.labels.push('Less than 3%');
            } else {
              const lessThan3Index = accumulator.labels.indexOf('Less than 3%');
              accumulator.values[lessThan3Index] += sharedReq.nb_reqs[index] - sharedReq.nb_successful_reqs[index];
            }
          }
          return accumulator;
        },
          { values: [], labels: [] }
        );
        // show total requests at first
        const pieDataRequests = {
          values: groupedDataTot.values,
          labels: groupedDataTot.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
          updatemenus: [{
            buttons: [
              // total requests button
              {
                args: [
                  {
                    values: [groupedDataTot.values],
                    labels: [groupedDataTot.labels],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of requests',
                  }
                ],
                label: 'Total Requests',
                method: 'update'
              },
              // successful requests button
              {
                args: [
                  {
                    values: [groupedDataSucc.values],
                    labels: [groupedDataSucc.labels],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of successful requests',
                  }
                ],
                label: 'Successful Requests',
                method: 'update'
              },
              // unsuccessful requests button
              {
                args: [
                  {
                    values: [groupedDataUnsucc.values],
                    labels: [groupedDataUnsucc.labels],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unsuccessful requests',
                  }
                ],
                label: 'Unsuccessful Requests',
                method: 'update'
              }
            ],
            direction: 'down',
            type: 'buttons'
          }]
        };
        Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      let url;
      if (isAuthenticated) {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&details=${details}&hllvalues=true&format=json`;
      }
      else {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&details=${details}&hllvalues=true&format=json`;
      }
      fetch(url, {method: isAuthenticated ? 'POST' : 'GET', body: isAuthenticated ? file : null})
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
          let networksSorted;
          if (single) {
            networksSorted = Array.from(new Set(data.results.map(result => result.node))).sort((a, b) => a.localeCompare(b)).reverse();
          } else {
            networksSorted = Array.from(new Set(data.results.map(result => result.network))).sort((a, b) => a.localeCompare(b)).reverse();
          }
          // calculate hll values for total clients all networks bar plot
          let hlls = {};
          data.results.forEach(result => {
            if (!hlls[result.date]) {
              hlls[result.date] = new HLL(11, 5);
            }
            hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
          });
          // needed for clients of all specified networks plot
          let clientsAllNetworks = [];
          networksSorted.forEach(network => {
            clientsAllNetworks.push([]);
          });
          clientsAllNetworks[networksSorted.length - 1] = Object.values(hlls).map(hll => hll.cardinality());
          // show clients at first
          // take care the case of shared networks
          const barData = networksSorted.map(network => {
            let networkResults;
            if (single) {
              networkResults = data.results.filter(result => result.node === network);
            } else {
              networkResults = data.results.filter(result => result.network === network);
            }
            // group results by date
            const groupedResults = networkResults.reduce((grouped, result) => {
              if (!grouped[result.date]) {
                grouped[result.date] = [];
              }
              grouped[result.date].push(result);
              return grouped;
            }, {});
            // calculate aggregated values for each date
            const aggregatedResults = Object.entries(groupedResults).map(([date, results]) => {
              const y1 = results.reduce((acc, result) => acc.union(fromHexString(result.hll_clients).hllSet), new HLL(11, 5));
              const y2 = results.reduce((sum, result) => sum + result.bytes, 0);
              const y3 = results.reduce((sum, result) => sum + result.nb_reqs, 0);
              const y4 = results.reduce((sum, result) => sum + result.nb_successful_reqs, 0);
              const y5 = results.reduce((sum, result) => sum + (result.nb_reqs - result.nb_successful_reqs), 0);
              return {date, y1, y2, y3, y4, y5};
            });
            return {
              x: aggregatedResults.map(result => result.date),
              y1: aggregatedResults.map(result => result.y1.cardinality()),
              y2: aggregatedResults.map(result => result.y2),
              y3: aggregatedResults.map(result => result.y3),
              y4: aggregatedResults.map(result => result.y4),
              y5: aggregatedResults.map(result => result.y5),
              name: single ? `${net} (${network})` : (network ? network : "N/A"),
              type: 'bar'
            };
          });
          let barLayout = {
            height: 500,
            margin: {
              b: 100
            },
            barmode: 'stack',
            title: 'Number of users* per '+details,
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
                text: '*<i>Important note: The number of unique users is correct for each network. However, the total number of unique users for all selected networks,<br> i.e. the height of the bars, does not represent the real value, as many clients may have asked data from multiple networks.<\i>',
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
                // clients per network button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y1),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of users* per '+details,
                      yaxis: {
                        title: 'Unique users*'
                      },
                      showlegend: true,
                      annotations: [
                        {
                          y: -0.32,
                          xref: 'paper',
                          yref: 'paper',
                          text: '*<i>Important note: The number of unique users is correct for each network. However, the total number of unique users for all selected networks,<br> i.e. the height of the bars, does not represent the real value, as many clients may have asked data from multiple networks.<\i>',
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
                  label: 'Users Per Network',
                  method: 'update'
                },
                // clients all specified networks button
                {
                  args: [
                    {
                      x: [Object.keys(hlls)],
                      y: clientsAllNetworks,
                      name: Array(networksSorted.length).fill(""),
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users of all specified networks per '+details,
                      yaxis: {
                        title: 'Unique Users'
                      },
                      showlegend: false,
                      annotations: []
                    }
                  ],
                  label: 'Users All Networks',
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
                // total requests button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y3),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of total requests per '+details,
                      yaxis: {
                        title: 'Total Requests'
                      },
                      showlegend: true,
                      annotations: []
                    }
                  ],
                  label: 'Total Requests',
                  method: 'update'
                },
                // successful requests button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y4),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of successful requests per '+details,
                      yaxis: {
                        title: 'Successful Requests'
                      },
                      showlegend: true,
                      annotations: []
                    }
                  ],
                  label: 'Successful Requests',
                  method: 'update'
                },
                // unsuccessful requests button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y5),
                      name: barData.map(bar => bar.name),
                      type: 'bar'
                    },
                    {
                      title: 'Number of unsuccessful requests per '+details,
                      yaxis: {
                        title: 'Unsuccessful Requests'
                      },
                      showlegend: true,
                      annotations: []
                    }
                  ],
                  label: 'Unsuccessful Requests',
                  method: 'update'
                }
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
      let url;
      if (isAuthenticated) {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&details=country&hllvalues=true&format=json`;
      } else {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&details=country&hllvalues=true&format=json`;
      }
      fetch(url, {method: isAuthenticated ? 'POST' : 'GET', body: isAuthenticated ? file : null})
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
                nb_reqs: 0,
                nb_successful_reqs: 0,
              };
            }
            aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
            aggregate[result.country].bytes += result.bytes;
            aggregate[result.country].nb_reqs += result.nb_reqs;
            aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
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
                // total requests button
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
                      title: 'Number of total requests per country',
                    }
                  ],
                  label: 'Total Requests',
                  method: 'update'
                },
                // successful requests button
                {
                  args: [
                    {
                      z: [Object.values(aggregatedResults).map(result => result.nb_successful_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of successful requests per country',
                    }
                  ],
                  label: 'Successful Requests',
                  method: 'update'
                },
                // unsuccessful requests button
                {
                  args: [
                    {
                      z: [Object.values(aggregatedResults).map(result => result.nb_reqs - result.nb_successful_reqs)],
                      type: 'choroplethmapbox',
                      colorscale: 'Viridis',
                      autocolorscale: false,
                      reversescale: true
                    },
                    {
                      title: 'Number of unsuccessful requests per country',
                    }
                  ],
                  label: 'Unsuccessful Requests',
                  method: 'update'
                }
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          Plotly.newPlot('country-plots', mapData, mapLayout, {displaylogo: false});

          let networksSorted;
          if (single) {
            networksSorted = Array.from(new Set(data.results.map(result => result.node))).sort((a, b) => a.localeCompare(b));
          } else {
            networksSorted = Array.from(new Set(data.results.map(result => result.network))).sort((a, b) => a.localeCompare(b));
          }
          let networkCheckboxes = networksSorted.map((network, index) => (
            <div key={index}>
              <input type="checkbox" id={`network-${index}`} value={network} defaultChecked onChange={handleCheckboxClick} />
              <label htmlFor={`network-${index}`}>{single ? `${net} (${network})` : (network ? network : "N/A")}</label>
            </div>
          ));
          const networkCheckboxesContainer = document.getElementById('nns-checkboxes');
          networkCheckboxesContainer.innerHTML = '';
          ReactDOM.createRoot(networkCheckboxesContainer).render(networkCheckboxes);
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
            const selectedNetworks = [];
            checked.forEach((cb) => {
              selectedNetworks.push(cb.value);
            })
            let filteredData;
            if (single) {
              filteredData = data.results.filter((result) => selectedNetworks.includes(result.node));
            } else {
              filteredData = data.results.filter((result) => selectedNetworks.includes(result.network));
            }
            aggregatedResults = filteredData.reduce((aggregate, result) => {
              if (!aggregate[result.country]) {
                aggregate[result.country] = {
                  country: result.country,
                  clients: new HLL(11, 5),
                  bytes: 0,
                  nb_reqs: 0,
                  nb_successful_reqs: 0,
                };
              }
              aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
              aggregate[result.country].bytes += result.bytes;
              aggregate[result.country].nb_reqs += result.nb_reqs;
              aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
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
              } else if (activeButtonIndex === 3) {
                return result.nb_successful_reqs;
              } else if (activeButtonIndex === 4) {
                return result.nb_reqs - result.nb_successful_reqs;
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
              } else if (button && index === 3) {
                button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_successful_reqs)]
              } else if (button && index === 4) {
                button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_reqs - result.nb_successful_reqs)]
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
