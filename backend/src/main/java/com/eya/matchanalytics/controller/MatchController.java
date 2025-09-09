package com.eya.matchanalytics.controller;

import com.eya.matchanalytics.model.Event;
import com.eya.matchanalytics.model.Match;
import com.eya.matchanalytics.model.Player;
import com.eya.matchanalytics.repository.EventRepository;
import com.eya.matchanalytics.repository.MatchRepository;
import com.eya.matchanalytics.repository.PlayerRepository;
import com.eya.matchanalytics.service.MatchService;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class MatchController {

    private final MatchRepository matchRepo;
    private final PlayerRepository playerRepo;
    private final EventRepository eventRepo;
    private final MatchService matchService;

    public MatchController(MatchRepository matchRepo, PlayerRepository playerRepo,
                           EventRepository eventRepo, MatchService matchService) {
        this.matchRepo = matchRepo;
        this.playerRepo = playerRepo;
        this.eventRepo = eventRepo;
        this.matchService = matchService;
    }

    // GET /api/match  -> { match, players, events }
    @GetMapping("/match")
    public Map<String, Object> getMatchData() {
        Map<String, Object> result = new HashMap<>();
        result.put("match", matchRepo.findAll().stream().findFirst().orElse(null));
        result.put("players", playerRepo.findAll());
        result.put("events", eventRepo.findAll());
        return result;
    }

    // POST /api/event  -> crée event + met à jour stats/rating
    @PostMapping("/event")
    public Event addEvent(@RequestBody Event event) {
        event.setId(null);
        Event saved = eventRepo.save(event);
        matchService.updateStatsFor(saved);
        return saved;
    }

    // GET /api/player/{id}
    @GetMapping("/player/{id}")
    public Player getPlayer(@PathVariable Long id) {
        return playerRepo.findById(id).orElse(null);
    }
}
