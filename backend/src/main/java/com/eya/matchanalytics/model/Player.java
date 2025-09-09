package com.eya.matchanalytics.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "player")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class Player {

    @Id
    private Long id;

    @Column(nullable = false) private String name;
    @Column(nullable = false) private String team;
    private String position;

    // stats persistées (colonnes ajoutées dans init.sql)
    @Column(nullable = false) private int goals = 0;
    @Column(nullable = false) private int assists = 0;

    @Column(name = "form_rating", nullable = false)
    private double formRating = 0.0;
}
