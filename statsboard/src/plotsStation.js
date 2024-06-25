import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsStation(file, startTime, endTime, node, net, sta, topN=10) {

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
  let endYear = new Date().getFullYear();
  if (endTime) {
    endYear = endTime.split('-')[0];
  }
  if (startTime.split('-')[0] != endYear) {
    monthAndYearPlots("year");
  }
  mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&hllvalues=true&format=json`;
    fetch(url, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
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
        // calculate hll values for total clients all stations indicator plot
        let hll = new HLL(11, 5);
        data.results.forEach((result) => {
          hll.union(fromHexString(result.hll_clients).hllSet);
        });
        // clients plot
        // show topN items and group the rest
        const topDataClients = data.results.sort((a, b) => b.clients - a.clients).slice(0, topN).map(result => ({
          station: result.network + '.' + result.station,
          clients: result.clients
        }));
        topDataClients.sort((a, b) => a.station.localeCompare(b.station));
        const totalClientsGroupedSlice = data.results.reduce((total, result) => {
          if (!topDataClients.map(item => item.station).includes(result.network + '.' + result.station)) {
            return total + result.clients;
          }
          return total;
        }, 0);
        const groupedSliceClients = {
          station: 'Grouped Items',
          clients: totalClientsGroupedSlice,
          belongsHere: data.results.filter(result => !topDataClients.map(item => item.station).includes(result.network + '.' + result.station)).map(result => result.network + '.' + result.station),
        };
        if (groupedSliceClients.clients > 0) {
          topDataClients.push({station: groupedSliceClients.station, clients: groupedSliceClients.clients});
        }
        // per station pie at first
        const pieDataClients = {
          values: topDataClients.map(item => item.clients),
          labels: topDataClients.map(item => item.station),
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: topDataClients.map(result => result.station === 'Grouped Items' ? groupedSliceClients.belongsHere.join('<br>') : ''),
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
              text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each station. However, the whole pie does not<br>represent the real value of the total users for all selected stations,<br>as many clients may have asked data from multiple stations.<\i>',
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
                    values: [topDataClients.map(item => item.clients)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unique users*',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.29,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each station. However, the whole pie does not<br>represent the real value of the total users for all selected stations,<br>as many clients may have asked data from multiple stations.<\i>',
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
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.29,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: Unique users are estimated based on<br>anonymised distinct IP addresses of the clients issuing requests.<\i>',
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
        // show topN items and group the rest
        const topDataBytes = data.results.sort((a, b) => b.bytes - a.bytes).slice(0, topN).map(result => ({
          station: result.network + '.' + result.station,
          bytes: result.bytes
        }));
        topDataBytes.sort((a, b) => a.station.localeCompare(b.station));
        const totalBytesGroupedSlice = data.results.reduce((total, result) => {
          if (!topDataBytes.map(item => item.station).includes(result.network + '.' + result.station)) {
            return total + result.bytes;
          }
          return total;
        }, 0);
        const groupedSliceBytes = {
          station: 'Grouped Items',
          bytes: totalBytesGroupedSlice,
          belongsHere: data.results.filter(result => !topDataBytes.map(item => item.station).includes(result.network + '.' + result.station)).map(result => result.network + '.' + result.station),
        };
        if (groupedSliceBytes.bytes > 0) {
          topDataBytes.push({station: groupedSliceBytes.station, bytes: groupedSliceBytes.bytes});
        }
        const pieDataBytes = {
          values: topDataBytes.map(item => item.bytes),
          labels: topDataBytes.map(item => item.station),
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: topDataBytes.map(result => result.station === 'Grouped Items' ? groupedSliceBytes.belongsHere.join('<br>') : ''),
          sort: false
        };
        const pieLayoutBytes = {
          title: 'Total number of bytes',
          annotations: [
            {
              xshift: +10,
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '<i>The above plot shows the amount of data delivered during<br>the use of EIDA services in the specified time period.<\i>',
              showarrow: false,
              font: {
                family: 'Arial',
                size: 12,
                color: 'black'
              }
            }
          ],
        };
        Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, {displaylogo: false});

        // requests plot
        // show topN items and group the rest
        const topDataRequests = data.results.sort((a, b) => b.nb_reqs - a.nb_reqs).slice(0, topN).map(result => ({
          station: result.network + '.' + result.station,
          nb_reqs: result.nb_reqs
        }));
        topDataRequests.sort((a, b) => a.station.localeCompare(b.station));
        const totalRequestsGroupedSlice = data.results.reduce((total, result) => {
          if (!topDataRequests.map(item => item.station).includes(result.network + '.' + result.station)) {
            return total + result.nb_reqs;
          }
          return total;
        }, 0);
        const groupedSliceRequests = {
          station: 'Grouped Items',
          nb_reqs: totalRequestsGroupedSlice,
          belongsHere: data.results.filter(result => !topDataRequests.map(item => item.station).includes(result.network + '.' + result.station)).map(result => result.network + '.' + result.station),
        };
        if (groupedSliceRequests.nb_reqs > 0) {
          topDataRequests.push({station: groupedSliceRequests.station, nb_reqs: groupedSliceRequests.nb_reqs});
        }
        const pieDataRequests = {
          values: topDataRequests.map(item => item.nb_reqs),
          labels: topDataRequests.map(item => item.station),
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: topDataRequests.map(result => result.station === 'Grouped Items' ? groupedSliceRequests.belongsHere.join('<br>') : ''),
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
          annotations: [
            {
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '<i>The above plot shows the number of requests made to<br>the EIDA services in the specified time period.<\i>',
              showarrow: false,
              font: {
                family: 'Arial',
                size: 12,
                color: 'black'
              }
            }
          ],
        };
        Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, {displaylogo: false});
      })
      .catch((error) => console.log(error));
    }

    function monthAndYearPlots(details = "month") {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&details=${details}&hllvalues=true&format=json`;
      fetch(url, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
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
          const stationsSet = Array.from(new Set(data.results.map(result => result.station)));
          // calculate hll values for total clients all stations bar plot
          let hlls = {};
          data.results.forEach(result => {
            if (!hlls[result.date]) {
              hlls[result.date] = new HLL(11, 5);
            }
            hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
          });
          // show clients at first
          const barData = stationsSet.map(station => {
              const stationResults = data.results.filter(result => result.station === station);
              return {
                x: stationResults.map(result => result.date),
                y1: stationResults.map(result => result.clients),
                y2: stationResults.map(result => result.bytes),
                y3: stationResults.map(result => result.nb_reqs),
                name: stationResults[0].network + '.' + stationResults[0].station,
                type: 'scatter',
                mode: 'lines+markers',
                hovertemplate: '(%{x}, %{y:.3s})',
              }
          });

          // show topN items and group the rest for clients
          barData.sort((a, b) => {
            const totalA = a.y1.reduce((sum, value) => sum + value, 0);
            const totalB = b.y1.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataClients = {
            x: [],
            y1: {},
            name: 'Grouped Items',
            type: 'scatter',
            mode: 'lines+markers',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataClients = [...barData];
          if (barDataClients.length > topN) {
            for (let i = topN; i < barDataClients.length; i++) {
              const item = barDataClients[i];
              item.x.forEach((date, i) => {
                if (!otherDataClients.x.includes(date)) {
                  otherDataClients.x.push(date);
                }
                otherDataClients.y1[date] = (otherDataClients.y1[date] || 0) + item.y1[i];
              });
            }
            otherDataClients.y1 = Object.values(otherDataClients.y1);
            barDataClients.splice(topN, barDataClients.length - topN);
          }
          barDataClients.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataClients.x.length > 0) {
            barDataClients.push(otherDataClients);
          }
          // needed for clients of all specified stations plot
          let clientsAllStations = Array(barDataClients.length).fill([]);
          clientsAllStations[barDataClients.length - 1] = Object.values(hlls).map(hll => hll.cardinality());

          // show topN items and group the rest for bytes
          barData.sort((a, b) => {
            const totalA = a.y2.reduce((sum, value) => sum + value, 0);
            const totalB = b.y2.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataBytes = {
            x: [],
            y2: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataBytes = [...barData];
          if (barDataBytes.length > topN) {
            for (let i = topN; i < barDataBytes.length; i++) {
              const item = barDataBytes[i];
              item.x.forEach((date, i) => {
                if (!otherDataBytes.x.includes(date)) {
                  otherDataBytes.x.push(date);
                }
                otherDataBytes.y2[date] = (otherDataBytes.y2[date] || 0) + item.y2[i];
              });
            }
            otherDataBytes.y2 = Object.values(otherDataBytes.y2);
            barDataBytes.splice(topN, barDataBytes.length - topN);
          }
          barDataBytes.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataBytes.x.length > 0) {
            barDataBytes.push(otherDataBytes);
          }

          // show topN items and group the rest for total requests
          barData.sort((a, b) => {
            const totalA = a.y3.reduce((sum, value) => sum + value, 0);
            const totalB = b.y3.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataRequests = {
            x: [],
            y3: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataRequests = [...barData];
          if (barDataRequests.length > topN) {
            for (let i = topN; i < barDataRequests.length; i++) {
              const item = barDataRequests[i];
              item.x.forEach((date, i) => {
                if (!otherDataRequests.x.includes(date)) {
                  otherDataRequests.x.push(date);
                }
                otherDataRequests.y3[date] = (otherDataRequests.y3[date] || 0) + item.y3[i];
              });
            }
            otherDataRequests.y3 = Object.values(otherDataRequests.y3);
            barDataRequests.splice(topN, barDataRequests.length - topN);
          }
          barDataRequests.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataRequests.x.length > 0) {
            barDataRequests.push(otherDataRequests);
          }

          let barLayout = {
            height: 500,
            margin: {
              b: 100
            },
            barmode: 'stack',
            title: 'Number of unique users per '+details,
            annotations: [
              {
                y: -0.28,
                yref: 'paper',
                xref: 'paper',
                text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: 'black'
                }
              }
            ],
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1),
              tickmode: 'linear'
            },
            yaxis: {
              title: 'Unique users'
            },
            showlegend: true,
            updatemenus: [{
              buttons: [
                // clients per station button
                {
                  args: [
                    {
                      x: barDataClients.map(bar => bar.x),
                      y: barDataClients.map(bar => bar.y1),
                      name: barDataClients.map(bar => bar.name),
                      type: 'scatter',
                      hovertemplate: '(%{x}, %{y:.3s})',
                    },
                    {
                      title: 'Number of unique users per '+details,
                      annotations: [
                        {
                          y: -0.28,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Unique users'
                      },
                      showlegend: true,
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
                      name: Array(clientsAllStations.length).fill(""),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of unique users of all specified stations per '+details,
                      annotations: [
                        {
                          y: -0.28,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Unique Users'
                      },
                      showlegend: false,
                    }
                  ],
                  label: 'Unique Users All Stations',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      x: barDataBytes.map(bar => bar.x).reverse(),
                      y: barDataBytes.map(bar => bar.y2).reverse(),
                      name: barDataBytes.map(bar => bar.name).reverse(),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of bytes per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the amount of data delivered during the use of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Bytes'
                      },
                      showlegend: true,
                    }
                  ],
                  label: 'Bytes',
                  method: 'update'
                },
                // requests button
                {
                  args: [
                    {
                      x: barDataRequests.map(bar => bar.x).reverse(),
                      y: barDataRequests.map(bar => bar.y3).reverse(),
                      name: barDataRequests.map(bar => bar.name).reverse(),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of requests per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: `<i>The above plot shows the number of requests made to the EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Requests'
                      },
                      showlegend: true,
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
          Plotly.newPlot(details+'-plots', barDataClients.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: bar.type, mode: bar.mode, hovertemplate: bar.hovertemplate})), barLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}${sta ? `&station=${sta}` : ''}&level=station&details=country&hllvalues=true&format=json`;
      fetch(url, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: file})
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
            annotations: [
              {
                y: -0.15,
                yref: 'paper',
                xref: 'paper',
                text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                showarrow: false,
                font: {
                  family: 'Arial',
                  size: 12,
                  color: 'black'
                }
              }
            ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the amount of data delivered to users of EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of requests made to the EIDA services from each country.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
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
          const stationsSorted = Array.from(new Set(data.results.map(result => result.network ? result.network + '.' + result.station : result.station))).sort((a, b) => a.localeCompare(b));
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
