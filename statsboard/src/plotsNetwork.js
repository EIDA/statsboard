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

  // icon for custom modebar button for downloading data in csv
  let icon = {
    'width': 24,
    'height': 24,
    'path': 'M11 3.01254C10.9983 2.46026 11.4446 2.01114 11.9969 2.00941C12.5492 2.00768 12.9983 2.45399 13 3.00627L11 3.01254Z ' +
            'M14.3158 10.2951L13.0269 11.592L13 3.00627L11 3.01254L11.0269 11.5983L9.73003 10.3095C9.33828 9.92018 8.7051 9.92214 8.3158 10.3139C7.9265 10.7056 7.92849 11.3388 8.32024 11.7281L8.32275 11.7306L8.32374 11.7316L12.039 15.4236L15.7206 11.7187L15.7262 11.7131L15.727 11.7123L15.7278 11.7115L15.7337 11.7056L15.7344 11.7049L14.3158 10.2951Z ' +
            'M15.7344 11.7049C16.1237 11.3131 16.1217 10.6799 15.73 10.2906C15.3382 9.90134 14.705 9.90335 14.3158 10.2951L15.7344 11.7049Z ' +
            'M4 12C4 10.8954 4.89543 10 6 10C6.55228 10 7 9.55228 7 9C7 8.44771 6.55228 8 6 8C3.79086 8 2 9.79086 2 12V18C2 20.2091 3.79086 22 6 22H17C19.7614 22 22 19.7614 22 17V12C22 9.79086 20.2091 8 18 8C17.4477 8 17 8.44771 17 9C17 9.55228 17.4477 10 18 10C19.1046 10 20 10.8954 20 12V17C20 18.6569 18.6569 20 17 20H6C4.89543 20 4 19.1046 4 18V12Z'
  };

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
    let url;
    if (isAuthenticated) {
      url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/restricted?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&hllvalues=true&format=json`;
    } else {
      url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${net ? `&network=${net}` : ''}&level=network&hllvalues=true&format=json`;
    }
    fetch(url, {method: isAuthenticated ? 'POST' : 'GET', headers: isAuthenticated ? {'Content-Type': 'application/octet-stream'} : {}, body: isAuthenticated ? file : null})
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

        // function to create a custom modebar button for downloading data as CSV
        function createDownloadButton() {
          return {
            name: 'Download CSV',
            icon: icon,
            click: function(gd) {
              const { csvHeader, csvRows } = getCurrentValues(gd);
              let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
              csvRows.forEach(row => {
                csvContent += row.join(',') + "\n";
              });
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "data.csv");
              document.body.appendChild(link); // Required for Firefox
              link.click();
              document.body.removeChild(link); // Clean up after download
            }
          };
        }
        // function to get current plot values based on the title
        function getCurrentValues(gd) {
          const title = gd.layout.title.text;
          let csvHeader, csvRows = [];
          if (title.includes('users')) {
            csvHeader = "Network,Users";
            data.results.forEach(result => {
              csvRows.push([single ? `${result.node}.${result.network}` : result.network, result.clients]);
            });
          } else if (title.includes('bytes')) {
            csvHeader = "Network,Bytes";
            data.results.forEach(result => {
              csvRows.push([single ? `${result.node}.${result.network}` : result.network, result.bytes]);
            });
          } else if (title.includes('requests')) {
            csvHeader = "Network,Requests";
            data.results.forEach(result => {
              csvRows.push([single ? `${result.node}.${result.network}` : result.network, result.nb_reqs]);
            });
          }
          return { csvHeader, csvRows };
        }
        // config for modebar
        const config = {
            displaylogo: false,
            modeBarButtonsToAdd: [createDownloadButton()]
        };

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
          title: 'Total number of unique users* per network',
          annotations: [
            {
              xshift: -20,
              y: -0.29,
              xref: 'paper',
              yref: 'paper',
              text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each network. However, the whole pie does not<br>represent the real value of the total users for all selected networks,<br>as many clients may have asked data from multiple networks.<\i>',
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
                    title: 'Total number of unique users* per network',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.29,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each network. However, the whole pie does not<br>represent the real value of the total users for all selected networks,<br>as many clients may have asked data from multiple networks.<\i>',
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
                    title: 'Total number of unique users* of all networks',
                    annotations: [
                      {
                        xshift: -20,
                        y: -0.25,
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
                label: 'Users All Networks',
                method: 'update'
              }
            ],
            direction: 'down',
            type: 'buttons'
          }]
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, config);

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
            groupedDataBytes.labels.push(network);
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
        Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, config);

        // requests plot
        // take care of shared networks
        const sharedReq = data.results.reduce((accumulator, result) => {
          let network = single ? result.node : result.network || "N/A";
          const index = accumulator.networks.indexOf(network);
          if (index !== -1) {
            accumulator.nb_reqs[index] += result.nb_reqs;
          } else {
            accumulator.nb_reqs.push(result.nb_reqs);
            accumulator.networks.push(single ? `${net} (${network})` : network);
          }
          return accumulator;
        }, { nb_reqs: [], networks: [] });
        // show topN items and group the rest
        let groupedDataReq = { values: [], labels: [], belongsInLess: [] };
        let otherValueReq = 0;
        const sortedNetsReq = sharedReq.networks.map((network, index) => ({
          network,
          nb_reqs: sharedReq.nb_reqs[index]
        })).sort((a, b) => b.nb_reqs - a.nb_reqs);
        sortedNetsReq.forEach(({ network, nb_reqs }, index) => {
          if (index < topN) {
            groupedDataReq.values.push(nb_reqs);
            groupedDataReq.labels.push(network);
          } else {
            groupedDataReq.belongsInLess.push(network);
            otherValueReq += nb_reqs;
          }
        });
        // sort alphabetically
        const sortedDataReq = groupedDataReq.labels.map((label, index) => ({
          label,
          value: groupedDataReq.values[index]
        })).sort((a, b) => a.label.localeCompare(b.label));
        groupedDataReq.labels = sortedDataReq.map(item => item.label);
        groupedDataReq.values = sortedDataReq.map(item => item.value);
        if (otherValueReq > 0) {
          groupedDataReq.values.push(otherValueReq);
          groupedDataReq.labels.push('Grouped Items');
        }
        const pieDataRequests = {
          values: groupedDataReq.values,
          labels: groupedDataReq.labels,
          type: 'pie',
          texttemplate: '%{value:.3s}',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra>%{customdata}</extra>',
          customdata: groupedDataReq.labels.map(label => label === 'Grouped Items' ? groupedDataReq.belongsInLess.join('<br>') : ''),
          sort: false
        };
        const pieLayoutRequests = {
          title: 'Total number of requests',
          annotations: [
            {
              xshift: +10,
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
          ]
        };
        Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, config);
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
      fetch(url, {method: isAuthenticated ? 'POST' : 'GET', headers: isAuthenticated ? {'Content-Type': 'application/octet-stream'} : {}, body: isAuthenticated ? file : null})
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
              return {date, y1, y2, y3};
            });
            return {
              x: aggregatedResults.map(result => result.date),
              y1: aggregatedResults.map(result => result.y1.cardinality()),
              y2: aggregatedResults.map(result => result.y2),
              y3: aggregatedResults.map(result => result.y3),
              name: single ? `${net} (${network})` : (network ? network : "N/A"),
              type: 'scatter',
              mode: 'lines+markers',
              hovertemplate: '(%{x}, %{y:.3s})',
            };
          });

          // function to create a custom modebar button for downloading data as CSV
          function createDownloadButton() {
            return {
              name: 'Download CSV',
              icon: icon,
              click: function(gd) {
                const { csvHeader, csvRows } = getCurrentValues(gd);
                let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
                csvRows.forEach(row => {
                  csvContent += row.join(',') + "\n";
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "data.csv");
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link); // Clean up after download
              }
            };
          }
          // function to get current plot values based on the title
          function getCurrentValues(gd) {
            const title = gd.layout.title.text;
            const monthOrYear = details.charAt(0).toUpperCase() + details.slice(1)
            let csvHeader, csvRows = [];
            if (title.includes('users* per')) {
              csvHeader = `${monthOrYear},Network,UsersPerNetwork`;
              data.results.forEach(result => {
                csvRows.push([result.date, single ? `${result.node}.${result.network}` : result.network, result.clients]);
              });
            } else if (title.includes('users* of all')) {
                csvHeader = `${monthOrYear},UsersAllNetworks`;
                Object.entries(hlls).forEach(item => {
                  csvRows.push([item[0], item[1].cardinality()]);
                });
            } else if (title.includes('bytes')) {
              csvHeader = `${monthOrYear},Network,Bytes`;
              data.results.forEach(result => {
                csvRows.push([result.date, single ? `${result.node}.${result.network}` : result.network, result.bytes]);
              });
            } else if (title.includes('requests')) {
              csvHeader = `${monthOrYear},Network,Requests`;
              data.results.forEach(result => {
                csvRows.push([result.date, single ? `${result.node}.${result.network}` : result.network, result.nb_reqs]);
              });
            }
            return { csvHeader, csvRows };
          }
          // config for modebar
          const config = {
              displaylogo: false,
              modeBarButtonsToAdd: [createDownloadButton()],
              modeBarButtonsToRemove: ['select2d','lasso2d','autoScale2d']
          };

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

          // show topN items and group the rest for requests
          barData.sort((a, b) => {
            const totalA = a.y3.reduce((sum, value) => sum + value, 0);
            const totalB = b.y3.reduce((sum, value) => sum + value, 0);
            return totalB - totalA;
          });
          let otherDataReq = {
            x: [],
            y3: {},
            name: 'Grouped Items',
            type: 'scatter',
            hovertemplate: '(%{x}, %{y:.3s})',
          };
          let barDataReq = [...barData];
          if (barDataReq.length > topN) {
            for (let i = topN; i < barDataReq.length; i++) {
              const item = barDataReq[i];
              item.x.forEach((date, i) => {
                if (!otherDataReq.x.includes(date)) {
                  otherDataReq.x.push(date);
                }
                otherDataReq.y3[date] = (otherDataReq.y3[date] || 0) + item.y3[i];
              });
            }
            otherDataReq.y3 = Object.values(otherDataReq.y3);
            barDataReq.splice(topN, barDataReq.length - topN);
          }
          barDataReq.sort((a, b) => {
            const nameA = a.name;
            const nameB = b.name;
            return nameA.localeCompare(nameB);
          });
          if (otherDataReq.x.length > 0) {
            barDataReq.push(otherDataReq);
          }

          let barLayout = {
            height: 500,
            margin: {
              b: 100
            },
            barmode: 'stack',
            title: 'Number of unique users* per '+details,
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
                      title: 'Number of unique users* per '+details,
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
                      title: 'Number of unique users* of all specified networks per '+details,
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
                      x: barDataReq.map(bar => bar.x).reverse(),
                      y: barDataReq.map(bar => bar.y3).reverse(),
                      name: barDataReq.map(bar => bar.name).reverse(),
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
          Plotly.newPlot(details+'-plots', barDataClients.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: bar.type, mode: bar.mode, hovertemplate: bar.hovertemplate})), barLayout, config);
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
      fetch(url, {method: isAuthenticated ? 'POST' : 'GET', headers: isAuthenticated ? {'Content-Type': 'application/octet-stream'} : {}, body: isAuthenticated ? file : null})
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

          // function to create a custom modebar button for downloading data as CSV
          function createDownloadButton() {
            return {
              name: 'Download CSV',
              icon: icon,
              click: function(gd) {
                const { csvHeader, csvRows } = getCurrentValues(gd);
                let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
                csvRows.forEach(row => {
                  csvContent += row.join(',') + "\n";
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "data.csv");
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link); // Clean up after download
              }
            };
          }
          // function to get current plot values based on the title
          function getCurrentValues(gd) {
            const title = gd.layout.title.text;
            let csvHeader, csvRows = [];
            if (title.includes('users')) {
              csvHeader = "Country,Network,Users";
              data.results.forEach(result => {
                csvRows.push([result.country, single ? `${result.node}.${result.network}` : result.network, result.clients]);
              });
            } else if (title.includes('bytes')) {
              csvHeader = "Country,Network,Bytes";
              data.results.forEach(result => {
                csvRows.push([result.country, single ? `${result.node}.${result.network}` : result.network, result.bytes]);
              });
            } else if (title.includes('requests')) {
              csvHeader = "Country,Network,Requests";
              data.results.forEach(result => {
                csvRows.push([result.country, single ? `${result.node}.${result.network}` : result.network, result.nb_reqs]);
              });
            }
            return { csvHeader, csvRows };
          }
          // config for modebar with the download button
          const config = {
            displaylogo: false,
            modeBarButtonsToAdd: [createDownloadButton()],
            modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
          };

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
            title: 'Number of unique users* per country',
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
                      title: 'Number of unique users* per country',
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
                }
              ],
              direction: 'down',
              type: 'buttons'
            }]
          };
          Plotly.newPlot('country-plots', mapData, mapLayout, config);

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
