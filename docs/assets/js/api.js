function getAuthorizationHeader() {
    const token = localStorage.getItem("token")
    return {
        Authorization: token ? `token ${token}` : "",
    }
}

async function getUserRepos(user) {
    let repoNames = []
    const url = `${apiRoot}users/${user}/repos`

    const res = await fetch(url, { headers: { ...getAuthorizationHeader() } })
    const json = await res.json()

    json.forEach(item => repoNames.push(item.name))
    return repoNames
}

async function getScope(repo, page, pageLength, scope) {
    let url = `${apiRoot}repos/${repo}/${scope.name}`
    if (page !== undefined) {
        url = `${url}?page=${page}&per_page=${pageLength}`
    }

    const res = await fetch(url, {
        method: "GET",
        headers: {
            ...scope.headers,
            ...getAuthorizationHeader(),
        },
    })
    const json = await res.json()
    return json
}

async function getRepoStargazer(repo, page, pageLength) {
    const json = await getScope(repo, page, pageLength, { name: "stargazers", headers: { Accept: "application/vnd.github.v3.star+json", }, })
    return json
}

async function getRepoForker(repo, page, pageLength) {
    const json = await getScope(repo, page, pageLength, { name: "forks", headers: {}, })
    return json
}

async function getRepoRelease(repo, page, pageLength) {
    const json = await getScope(repo, page, pageLength, { name: "releases", headers: {}, })
    return json
}

async function getRepoData(user, repo) {
    const res = await fetch(`${apiRoot}repos/${user}/${repo}`, { headers: { ...getAuthorizationHeader(), }, })
    const json = await res.json()
    return json
}

async function getRecordFor(user, repo, repoData, ressource) {
    const maxRessource = repoData[ressource.count] || ressource.count

    const maxRequests = ressource.maxReq || 15
    const pageLength = 100
    const range = [1, Math.ceil(maxRessource / pageLength)]
    const skipPage = Math.ceil((range[1] - range[0]) / maxRequests)

    let data = {
        keys: [],
        values: [],
    }
    let page = 1

    let step = 5
    if (ressource.value !== "count")
        step = 1

    while (true) {
        const next = await ressource.fetch(`${user}/${repo}`, page, pageLength)

        for (let i = 0; i * step < next.length; ++i) {
            data.keys.push(next[i * step][ressource.key])
            data.values.push(ressource.value === "count" ? 1 + i * step + (page - 1) * pageLength : next[i * step][ressource.value])
        }

        if (next.length < pageLength) {
            data.keys.push(next[next.length - 1][ressource.key])
            data.values.push(ressource.value === "count" ? next.length + (page - 1) * pageLength : next[next.length - 1][ressource.value])
        }

        if (next.length < pageLength) {
            break
        }
        page += skipPage
    }

    return {
        history: Object.fromEntries(data.keys.sort().map((el, i) => [el, data.values[i]])),
        total: maxRessource,
    }
}
