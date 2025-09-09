package com.eya.matchanalytics.service;

import com.eya.matchanalytics.model.Event;
import com.eya.matchanalytics.model.Player;
import com.eya.matchanalytics.repository.PlayerRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

@Service
public class MatchService {

    private final PlayerRepository playerRepo;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    public MatchService(PlayerRepository playerRepo) {
        this.playerRepo = playerRepo;
    }

    /** Recalcule un rating simple : base 6 + 1*goals + 0.5*assists ∈ [4;10]. */
    public void recalcRating(Player p) {
        double raw = 6.0 + 1.0 * p.getGoals() + 0.5 * p.getAssists();
        if (raw < 4.0) raw = 4.0;
        if (raw > 10.0) raw = 10.0;
        p.setFormRating(raw);
    }

    /** Met à jour les stats du/des joueur(s) impactés par l'événement. */
    public void updateStatsFor(Event saved) {
        if ("GOAL".equalsIgnoreCase(saved.getType())) {
            playerRepo.findById(saved.getPlayerId()).ifPresent(p -> {
                p.setGoals(p.getGoals() + 1);
                recalcRating(p);
                playerRepo.save(p);
            });

            var meta = saved.getMeta();
            if (meta != null && meta.get("assistId") != null) {
                long assistId = Long.parseLong(meta.get("assistId").toString());
                playerRepo.findById(assistId).ifPresent(a -> {
                    a.setAssists(a.getAssists() + 1);
                    recalcRating(a);
                    playerRepo.save(a);
                });
            }
        } else if ("ASSIST".equalsIgnoreCase(saved.getType())) {
            playerRepo.findById(saved.getPlayerId()).ifPresent(a -> {
                a.setAssists(a.getAssists() + 1);
                recalcRating(a);
                playerRepo.save(a);
            });
        }
    }

}
