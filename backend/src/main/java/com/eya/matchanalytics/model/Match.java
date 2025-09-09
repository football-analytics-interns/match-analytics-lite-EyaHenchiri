package com.eya.matchanalytics.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "match")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Match {

    @Id
    private Long id;

    @Column(nullable = false)
    private OffsetDateTime date;   // mappé sur TIMESTAMPTZ

    @Column(name = "home_team", nullable = false)
    private String homeTeam;

    @Column(name = "away_team", nullable = false)
    private String awayTeam;

    @Column(name = "home_score", nullable = false)
    private int homeScore;

    @Column(name = "away_score", nullable = false)
    private int awayScore;
}
