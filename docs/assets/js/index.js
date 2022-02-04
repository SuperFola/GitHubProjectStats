const apiRoot = "https://api.github.com/"

let pieChart = null
let lineChart = null

function formatNumber(value) {
    return value.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,')
}

function getURLParam(name) {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    return urlParams.get(name)
}

function showReleasesStats(data) {
    let err = false
    let errMessage = ''
    let html = ""

    if (data.status == 404) {
        err = true
        errMessage = "The project does not exist!"
    } else if (data.status == 403) {
        err = true
        errMessage = "You've exceeded GitHub's rate limiting.<br />Please try again in about an hour."
    }

    if (data.length == 0) {
        err = true
        errMessage = "There are no releases for this project"
    }

    if (err) {
        html += `<div class='col-md-6 col-md-offset-3 alert alert-danger'>${errMessage}</div>`
    } else {
        html += "<div class='row'>"

        let downloadsPerRelease = {}
        let totalDownloadCount = 0

        data.forEach(item => {
            let releaseTag = item.tag_name
            let releaseBadge = ""
            let releaseURL = item.html_url
            let isPreRelease = item.prerelease
            let releaseAssets = item.assets
            let releaseDownloadCount = 0
            let releaseAuthor = item.author
            let publishDate = item.published_at.split("T")[0]

            if (isPreRelease) {
                releaseBadge = "&nbsp;&nbsp;<span class='badge bg-warning'>Pre-release</span>"
            }

            let downloadInfoHTML = ""
            if (releaseAssets.length) {
                downloadInfoHTML += "<h4><span class='bi-download'></span>&nbsp;&nbsp;Download Info</h4>"
                downloadInfoHTML += "<ul>"

                releaseAssets.forEach(asset => {
                    let assetSize = (asset.size / 1048576.0).toFixed(2)
                    let lastUpdate = asset.updated_at.split("T")[0]

                    downloadInfoHTML += `<li><code>${asset.name}</code> (${assetSize}&nbsp;MiB,&nbsp;${lastUpdate}) - downloaded ${formatNumber(asset.download_count)}&nbsp;times.</li>`

                    totalDownloadCount += asset.download_count
                    releaseDownloadCount += asset.download_count
                })
            }

            let key = Object.keys(downloadsPerRelease).length > 8 ? "Others" : releaseTag
            downloadsPerRelease[key] = (downloadsPerRelease[key] || 0) + releaseDownloadCount

            html += "<div class='row release'>"
            html += `<h3><span class='bi-tag'></span>&nbsp;&nbsp;<a href='${releaseURL}' target='_blank'>${releaseTag}</a>${releaseBadge}</h3><hr>`
            html += "<h4><span class='bi-info-circle'></span>&nbsp;&nbsp;Release Info</h4>"
            html += "<ul>"

            if (releaseAuthor) {
                html += `<li><span class='bi-person'></span>&nbsp;&nbsp;Author: <a href='${releaseAuthor.html_url}'>@${releaseAuthor.login}</a></li>`
            }

            html += `<li><span class='bi-calendar'></span>&nbsp;&nbsp;Published: ${publishDate}</li>`

            if (releaseDownloadCount) {
                html += `<li><span class='bi-download'></span>&nbsp;&nbsp;Downloads: ${formatNumber(releaseDownloadCount)}</li>`
            }

            html += `</ul>${downloadInfoHTML}</div>`
        })


        if (pieChart !== null) {
            pieChart.destroy()
        }

        pieChart = new Chart("dlchart", {
            type: "pie",
            data: {
                labels: Array.from(Object.keys(downloadsPerRelease)),
                datasets: [{
                    backgroundColor: [
                        "#00876c",
                        "#44926c",
                        "#679d6f",
                        "#85a776",
                        "#a1b180",
                        "#babc8d",
                        "#d2c69e",
                        "#d1b583",
                        "#d2a26d",
                        "#d48d5c",
                        "#d67551",
                        "#d65c4e",
                        "#d43d51",
                    ],
                    data: Array.from(Object.values(downloadsPerRelease)),
                    radius: "66%",
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                width: "50%",
                height: "50%",
            },
        })

        if (totalDownloadCount) {
            let totalHTML = "<div class='row total-downloads'>"
            totalHTML += `<h4><span class='bi-download'></span>&nbsp;&nbsp;<span>${formatNumber(totalDownloadCount)}</span>&nbsp;Total Downloads</h4>`
            totalHTML += "</div>"

            html = totalHTML + html
        }

        html += "</div>"
    }

    document.getElementById("releases").innerHTML = html
}

async function getStarRecord(user, repo, repoData) {
    const maxStars = repoData["stargazers_count"]

    const maxRequests = 15
    const pageLength = 100
    const range = [1, Math.ceil(maxStars / pageLength)]
    const skipPage = Math.ceil((range[1] - range[0]) / maxRequests)

    let stars = {}
    let page = 1

    while (true) {
        const data = await getRepoStargazer(`${user}/${repo}`, page, pageLength)

        for (let i = 0, step = (data.length === pageLength) ? 20 : 4; i * step < data.length; ++i) {
            stars[data[i * step]] = 1 + i * step + (page - 1) * pageLength
        }

        if (data.length < pageLength) {
            break
        }
        page += skipPage
    }

    return {
        history: stars,
        total: maxStars,
    }
}

async function getForkRecord(user, repository, repoData) {
    const maxForks = repoData["forks_count"]

    let forks = {}

    return {
        total: maxForks,
        history: forks,
    }
}

async function showHistoryStats(user, repository) {
    if (lineChart !== null) {
        lineChart.destroy()
    }

    const repoData = await getRepoData(user, repository)

    let starsData = await getStarRecord(user, repository, repoData)
    let starsX = [...new Set(Object.values(starsData.history))]
    let starsY = [...new Set(Object.keys(starsData.history))].map(d => (new Date(d)).getTime())

    let forksData = await getForkRecord(user, repository, repoData)

    lineChart = new Chart("linechart", {
        type: "line",
        data: {
            labels: starsY,
            datasets: [{
                pointRadius: 0,
                borderColor: 'rgba(0, 0, 0, 0.8)',
                data: starsX,
                label: 'Stars',
                tension: 0.3,
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'week',
                    },
                },
                yAxis: {
                    max: starsData.total,
                },
            },
        },
    })
}

async function getStats(user, repository, page, perPage) {
    document.getElementById("project").innerText = `${user}/${repository}`

    // releases
    {
        const url = `${apiRoot}repos/${user}/${repository}/releases?page=${page}&per_page=${perPage}`
        const res = await fetch(url)
        const json = await res.json()
        showReleasesStats(json)
    }
    // history (stars, forks...)
    {
        await showHistoryStats(user, repository)
    }
}

window.onload = () => {
    if (getURLParam("user") && getURLParam("repo")) {
        getStats(getURLParam("user"), getURLParam("repo"))
    }

    if (localStorage.getItem("token")) {
        document.getElementById("github_token").value = localStorage.getItem("token")
    }

    document.getElementById("set_token_btn").addEventListener("click", () => {
        let input = document.getElementById("github_token")
        input.hidden = !input.hidden
    })

    document.getElementById("get_stats_btn").addEventListener("click", () => {
        let token = document.getElementById("github_token").value
        if (token) {
            localStorage.setItem("token", token)
        }

        let user = document.getElementById("github_user").value
        let repo = document.getElementById("github_repo").value

        if (user !== "" && repo !== "") {
            getStats(user, repo, 0, 50)
        } else {
            alert("Incomplete informations")
        }
    })
}
