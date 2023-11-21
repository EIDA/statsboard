import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsNetwork(isAuthenticated, file, startTime, endTime, node, net, single=false, topN=10) {
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
        // calculate hll values for shared networks and for total clients all networks indicator plot
        let foundNets = {};
        let hll = new HLL(11, 5);
        data.results.forEach((result) => {
          let network = single ? result.node : result.network || "N/A";
          if (foundNets[network]) {
            foundNets[network].union(fromHexString(result.hll_clients).hllSet);
          } else {
            foundNets[network] = fromHexString(result.hll_clients).hllSet;
          }
          hll.union(fromHexString(result.hll_clients).hllSet);
        });
        // show topN items and group the rest
        let groupedDataClients = { values: [], labels: [], belongsInLess: [] };
        let otherValueClients = 0;
        const sortedNetsClients = Object.entries(foundNets).sort((a, b) => b[1].cardinality() - a[1].cardinality());
        sortedNetsClients.forEach(([network, value], index) => {
          if (index < topN) {
            groupedDataClients.values.push(value.cardinality());
            groupedDataClients.labels.push(single ? `${net} (${network})` : network);
          } else {
            groupedDataClients.belongsInLess.push(network);
            otherValueClients += value.cardinality();
          }
        });
        // sort alphabetically
        const sortedDataClients = groupedDataClients.labels.map((label, index) => ({
          label,
          value: groupedDataClients.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataClients.labels = sortedDataClients.map(item => item.label);
        groupedDataClients.values = sortedDataClients.map(item => item.value);
        if (otherValueClients > 0) {
          groupedDataClients.values.push(otherValueClients);
          groupedDataClients.labels.push('Grouped Items');
        }
        // clients plot, per network pie at first
        let pieDataClients = {
          values: groupedDataClients.values,
          labels: groupedDataClients.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: groupedDataClients.labels.map(label => label === 'Grouped Items' ? groupedDataClients.belongsInLess.join('<br>') : ''),
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
                    values: [groupedDataClients.values],
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
          let network = single ? result.node : result.network || "N/A";
          const index = accumulator.networks.indexOf(network);
          if (index !== -1) {
            accumulator.bytes[index] += result.bytes;
          } else {
            accumulator.bytes.push(result.bytes);
            accumulator.networks.push(single ? `${net} (${network})` : network);
          }
          return accumulator;
        }, { bytes: [], networks: [] });
        // show topN items and group the rest
        let groupedDataBytes = { values: [], labels: [], belongsInLess: [] };
        let otherValueBytes = 0;
        const sortedNetsBytes = sharedBytes.networks.map((network, index) => ({
          network,
          bytes: sharedBytes.bytes[index]
        })).sort((a, b) => b.bytes - a.bytes);
        sortedNetsBytes.forEach(({ network, bytes }, index) => {
          if (index < topN) {
            groupedDataBytes.values.push(bytes);
            groupedDataBytes.labels.push(single ? `${net} (${network})` : network);
          } else {
            groupedDataBytes.belongsInLess.push(network);
            otherValueBytes += bytes;
          }
        });
        // sort alphabetically
        const sortedDataBytes = groupedDataBytes.labels.map((label, index) => ({
          label,
          value: groupedDataBytes.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataBytes.labels = sortedDataBytes.map(item => item.label);
        groupedDataBytes.values = sortedDataBytes.map(item => item.value);
        if (otherValueBytes > 0) {
          groupedDataBytes.values.push(otherValueBytes);
          groupedDataBytes.labels.push('Grouped Items');
        }
        const pieDataBytes = {
          values: groupedDataBytes.values,
          labels: groupedDataBytes.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: groupedDataBytes.labels.map(label => label === 'Grouped Items' ? groupedDataBytes.belongsInLess.join('<br>') : ''),
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
        // take care of shared networks
        const sharedReq = data.results.reduce((accumulator, result) => {
          let network = single ? result.node : result.network || "N/A";
          const index = accumulator.networks.indexOf(network);
          if (index !== -1) {
            accumulator.nb_reqs[index] += result.nb_reqs;
            accumulator.nb_successful_reqs[index] += result.nb_successful_reqs;
          } else {
            accumulator.nb_reqs.push(result.nb_reqs);
            accumulator.nb_successful_reqs.push(result.nb_successful_reqs);
            accumulator.networks.push(single ? `${net} (${network})` : network);
          }
          return accumulator;
        }, { nb_reqs: [], nb_successful_reqs: [], networks: [] });
        // show topN items and group the rest for total requests
        let groupedDataTot = { values: [], labels: [], belongsInLess: [] };
        let otherValueTot = 0;
        const sortedNetsTot = sharedReq.networks.map((network, index) => ({
          network,
          nb_reqs: sharedReq.nb_reqs[index]
        })).sort((a, b) => b.nb_reqs - a.nb_reqs);
        sortedNetsTot.forEach(({ network, nb_reqs }, index) => {
          if (index < topN) {
            groupedDataTot.values.push(nb_reqs);
            groupedDataTot.labels.push(single ? `${net} (${network})` : network);
          } else {
            groupedDataTot.belongsInLess.push(network);
            otherValueTot += nb_reqs;
          }
        });
        // sort alphabetically
        const sortedDataTot = groupedDataTot.labels.map((label, index) => ({
          label,
          value: groupedDataTot.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataTot.labels = sortedDataTot.map(item => item.label);
        groupedDataTot.values = sortedDataTot.map(item => item.value);
        if (otherValueTot > 0) {
          groupedDataTot.values.push(otherValueTot);
          groupedDataTot.labels.push('Grouped Items');
        }
        // show topN items and group the rest for successful requests
        let groupedDataSucc = { values: [], labels: [], belongsInLess: [] };
        let otherValueSucc = 0;
        const sortedNetsSucc = sharedReq.networks.map((network, index) => ({
          network,
          nb_successful_reqs: sharedReq.nb_successful_reqs[index]
        })).sort((a, b) => b.nb_successful_reqs - a.nb_successful_reqs);
        sortedNetsSucc.forEach(({ network, nb_successful_reqs }, index) => {
          if (index < topN) {
            groupedDataSucc.values.push(nb_successful_reqs);
            groupedDataSucc.labels.push(single ? `${net} (${network})` : network);
          } else {
            groupedDataSucc.belongsInLess.push(network);
            otherValueSucc += nb_successful_reqs;
          }
        });
        // sort alphabetically
        const sortedDataSucc = groupedDataSucc.labels.map((label, index) => ({
          label,
          value: groupedDataSucc.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataSucc.labels = sortedDataSucc.map(item => item.label);
        groupedDataSucc.values = sortedDataSucc.map(item => item.value);
        if (otherValueSucc > 0) {
          groupedDataSucc.values.push(otherValueSucc);
          groupedDataSucc.labels.push('Grouped Items');
        }
        // show topN items and group the rest for unsuccessful requests
        let groupedDataUnsucc = { values: [], labels: [], belongsInLess: [] };
        let otherValueUnsucc = 0;
        const sortedNetsUnsucc = sharedReq.networks.map((network, index) => ({
          network,
          nb_unsuccessful_reqs: sharedReq.nb_reqs[index] - sharedReq.nb_successful_reqs[index]
        })).sort((a, b) => b.nb_unsuccessful_reqs - a.nb_unsuccessful_reqs);
        sortedNetsUnsucc.forEach(({ network, nb_unsuccessful_reqs }, index) => {
          if (index < topN) {
            groupedDataUnsucc.values.push(nb_unsuccessful_reqs);
            groupedDataUnsucc.labels.push(single ? `${net} (${network})` : network);
          } else {
            groupedDataUnsucc.belongsInLess.push(network);
            otherValueUnsucc += nb_unsuccessful_reqs;
          }
        });
        // sort alphabetically
        const sortedDataUnsucc = groupedDataUnsucc.labels.map((label, index) => ({
          label,
          value: groupedDataUnsucc.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataUnsucc.labels = sortedDataUnsucc.map(item => item.label);
        groupedDataUnsucc.values = sortedDataUnsucc.map(item => item.value);
        if (otherValueUnsucc > 0) {
          groupedDataUnsucc.values.push(otherValueUnsucc);
          groupedDataUnsucc.labels.push('Grouped Items');
        }
        // show total requests at first
        const pieDataRequests = {
          values: groupedDataTot.values,
          labels: groupedDataTot.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: groupedDataTot.labels.map(label => label === 'Grouped Items' ? groupedDataTot.belongsInLess.join('<br>') : ''),
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
          annotations: [
            {
              xshift: -20,
              y: -0.25,
              xref: 'paper',
              yref: 'paper',
              text: '<i>The above plot shows the number of total requests made to<br>the EIDA services in the specified time period.<\i>',
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
              // total requests button
              {
                args: [
                  {
                    values: [groupedDataTot.values],
                    labels: [groupedDataTot.labels],
                    customdata: [groupedDataTot.labels.map(label => label === 'Grouped Items' ? groupedDataTot.belongsInLess.join('<br>') : '')],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of requests',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
                        xref: 'paper',
                        yref: 'paper',
                        text: '<i>The above plot shows the number of total requests made to<br>the EIDA services in the specified time period.<\i>',
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
                label: 'Total Requests',
                method: 'update'
              },
              // successful requests button
              {
                args: [
                  {
                    values: [groupedDataSucc.values],
                    labels: [groupedDataSucc.labels],
                    customdata: [groupedDataSucc.labels.map(label => label === 'Grouped Items' ? groupedDataSucc.belongsInLess.join('<br>') : '')],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of successful requests',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
                        xref: 'paper',
                        yref: 'paper',
                        text: '<i>The above plot shows the number of successful requests made to<br>the EIDA services in the specified time period.<\i>',
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
                label: 'Successful Requests',
                method: 'update'
              },
              // unsuccessful requests button
              {
                args: [
                  {
                    values: [groupedDataUnsucc.values],
                    labels: [groupedDataUnsucc.labels],
                    customdata: [groupedDataUnsucc.labels.map(label => label === 'Grouped Items' ? groupedDataUnsucc.belongsInLess.join('<br>') : '')],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unsuccessful requests',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
                        xref: 'paper',
                        yref: 'paper',
                        text: '<i>The above plot shows the number of unsuccessful requests<br>(i.e. requests that did not return any data) made to<br>the EIDA services in the specified time period.<\i>',
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
          let networksSet = Array.from(new Set(data.results.map(result => single ? result.node : result.network)));
          // calculate hll values for total clients all networks bar plot
          let hlls = {};
          data.results.forEach(result => {
            if (!hlls[result.date]) {
              hlls[result.date] = new HLL(11, 5);
            }
            hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
          });
          // organize data and take care the case of shared networks
          const barData = networksSet.map(network => {
            let networkResults = data.results.filter(result => single ? result.node === network : result.network === network);
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
              type: 'scatter',
              mode: 'lines+markers',
              hovertemplate: '(%{x}, %{y:.3s})',
            };
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
          // needed for clients of all specified networks plot
          let clientsAllNetworks = Array(barDataClients.length).fill([]);
          clientsAllNetworks[barDataClients.length - 1] = Object.values(hlls).map(hll => hll.cardinality());

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
          let otherDataTot = {
            x: [],
            y3: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataTot = [...barData];
          if (barDataTot.length > topN) {
            for (let i = topN; i < barDataTot.length; i++) {
              const item = barDataTot[i];
              item.x.forEach((date, i) => {
                if (!otherDataTot.x.includes(date)) {
                  otherDataTot.x.push(date);
                }
                otherDataTot.y3[date] = (otherDataTot.y3[date] || 0) + item.y3[i];
              });
            }
            otherDataTot.y3 = Object.values(otherDataTot.y3);
            barDataTot.splice(topN, barDataTot.length - topN);
          }
          barDataTot.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataTot.x.length > 0) {
            barDataTot.push(otherDataTot);
          }

          // show topN items and group the rest for successful requests
          barData.sort((a, b) => {
            const totalA = a.y4.reduce((sum, value) => sum + value, 0);
            const totalB = b.y4.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataSucc = {
            x: [],
            y4: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataSucc = [...barData];
          if (barDataSucc.length > topN) {
            for (let i = topN; i < barDataSucc.length; i++) {
              const item = barDataSucc[i];
              item.x.forEach((date, i) => {
                if (!otherDataSucc.x.includes(date)) {
                  otherDataSucc.x.push(date);
                }
                otherDataSucc.y4[date] = (otherDataSucc.y4[date] || 0) + item.y4[i];
              });
            }
            otherDataSucc.y4 = Object.values(otherDataSucc.y4);
            barDataSucc.splice(topN, barDataSucc.length - topN);
          }
          barDataSucc.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataSucc.x.length > 0) {
            barDataSucc.push(otherDataSucc);
          }

          // show topN items and group the rest for unsuccessful requests
          barData.sort((a, b) => {
            const totalA = a.y5.reduce((sum, value) => sum + value, 0);
            const totalB = b.y5.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataUnsucc = {
            x: [],
            y5: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataUnsucc = [...barData];
          if (barDataUnsucc.length > topN) {
            for (let i = topN; i < barDataUnsucc.length; i++) {
              const item = barDataUnsucc[i];
              item.x.forEach((date, i) => {
                if (!otherDataUnsucc.x.includes(date)) {
                  otherDataUnsucc.x.push(date);
                }
                otherDataUnsucc.y5[date] = (otherDataUnsucc.y5[date] || 0) + item.y5[i];
              });
            }
            otherDataUnsucc.y5 = Object.values(otherDataUnsucc.y5);
            barDataUnsucc.splice(topN, barDataUnsucc.length - topN);
          }
          barDataUnsucc.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataUnsucc.x.length > 0) {
            barDataUnsucc.push(otherDataUnsucc);
          }

          let barLayout = {
            height: 500,
            margin: {
              b: 100
            },
            barmode: 'stack',
            title: 'Number of users per '+details,
            annotations: [
              {
                y: -0.27,
                yref: 'paper',
                xref: 'paper',
                text: '<i>The above plot shows the number of unique users of EIDA services per month.<\i>',
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
                // clients per network button
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
                      title: 'Number of users per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unique users of EIDA services per month.<\i>',
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
                  label: 'Users Per Network',
                  method: 'update'
                },
                // clients all specified networks button
                {
                  args: [
                    {
                      x: [Object.keys(hlls)],
                      y: clientsAllNetworks,
                      name: Array(clientsAllNetworks.length).fill(""),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of unique users of all specified networks per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unique users of EIDA services per month.<\i>',
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
                  label: 'Users All Networks',
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
                          text: '<i>The above plot shows the amount of data delivered during the use of EIDA services per month.<\i>',
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
                // total requests button
                {
                  args: [
                    {
                      x: barDataTot.map(bar => bar.x).reverse(),
                      y: barDataTot.map(bar => bar.y3).reverse(),
                      name: barDataTot.map(bar => bar.name).reverse(),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of total requests per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of total requests made to the EIDA services per month.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Total Requests'
                      },
                      showlegend: true,
                    }
                  ],
                  label: 'Total Requests',
                  method: 'update'
                },
                // successful requests button
                {
                  args: [
                    {
                      x: barDataSucc.map(bar => bar.x).reverse(),
                      y: barDataSucc.map(bar => bar.y4).reverse(),
                      name: barDataSucc.map(bar => bar.name).reverse(),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of successful requests per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of successful requests made to the EIDA services per month.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Successful Requests'
                      },
                      showlegend: true,
                    }
                  ],
                  label: 'Successful Requests',
                  method: 'update'
                },
                // unsuccessful requests button
                {
                  args: [
                    {
                      x: barDataUnsucc.map(bar => bar.x).reverse(),
                      y: barDataUnsucc.map(bar => bar.y5).reverse(),
                      name: barDataUnsucc.map(bar => bar.name).reverse(),
                      type: 'bar',
                      hovertemplate: '(%{x}, %{value:.3s})',
                    },
                    {
                      title: 'Number of unsuccessful requests per '+details,
                      annotations: [
                        {
                          y: -0.27,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unsuccessful requests (i.e. requests that did not return any data) made to the EIDA services per month.<\i>',
                          showarrow: false,
                          font: {
                            family: 'Arial',
                            size: 12,
                            color: 'black'
                          }
                        }
                      ],
                      yaxis: {
                        title: 'Unsuccessful Requests'
                      },
                      showlegend: true,
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
          Plotly.newPlot(details+'-plots', barDataClients.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: bar.type, mode: bar.mode, hovertemplate: bar.hovertemplate})), barLayout, {displaylogo: false});
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
            annotations: [
              {
                y: -0.15,
                yref: 'paper',
                xref: 'paper',
                text: '<i>The above plot shows the number of unique users of EIDA services from each country.<\i>',
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
                          text: '<i>The above plot shows the number of unique users of EIDA services from each country.<\i>',
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of total requests made to the EIDA services from each country.<\i>',
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of successful requests made to the EIDA services from each country.<\i>',
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
                      annotations: [
                        {
                          y: -0.15,
                          yref: 'paper',
                          xref: 'paper',
                          text: '<i>The above plot shows the number of unsuccesssful requests (i.e. requests that did not return any data) made to the EIDA services from each country.<\i>',
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
